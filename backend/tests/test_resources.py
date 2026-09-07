"""``app.routers.resources`` — the generic CRUD surface.

These tests assert on the SQL the app *actually sends upstream* rather than on
the JSON it returns, because the SQL is where the interesting behaviour lives:
paging clamps, the ORDER BY it picks, and whether a hostile query string can
reach the statement. Responses are checked where they carry their own logic
(the search path, the PUT merge).
"""

from __future__ import annotations

import re
from dataclasses import replace

import pytest

from app.entities import get_entity
from app.routers.resources import _gen_key, _matches_q

LIST_SQL = "SELECT * FROM legal.matters ORDER BY date_opened ASC LIMIT 500 OFFSET 0"
COUNT_SQL = "SELECT COUNT(*) AS c FROM legal.matters"


# ===========================================================================
# Listing: the composed statement
# ===========================================================================


def test_list_builds_the_expected_statement_and_a_matching_count(api, fake):
    resp = api.get("/api/matters")

    assert resp.status_code == 200
    # Two statements: the page, then the unpaged count for `total`.
    assert fake.sql_log == [LIST_SQL, COUNT_SQL]


def test_list_defaults_order_by_to_the_entity_registry(api, fake):
    """Each entity declares its own default sort; the router must honour it."""
    api.get("/api/time_entries")
    assert "ORDER BY date ASC" in fake.sql_log[0]

    fake.reset()
    api.get("/api/clients")
    assert "ORDER BY client_name ASC" in fake.sql_log[0]


def test_list_accepts_an_explicit_order_by_and_direction(api, fake):
    api.get("/api/matters", query_string={"order_by": "client_name", "order_dir": "desc"})
    assert fake.sql_log[0] == (
        "SELECT * FROM legal.matters ORDER BY client_name DESC LIMIT 500 OFFSET 0"
    )


@pytest.mark.parametrize(
    "order_dir,expected",
    [
        ("desc", "DESC"),
        ("DESC", "DESC"),
        ("DeSc", "DESC"),
        ("asc", "ASC"),
        ("", "ASC"),
        ("sideways", "ASC"),  # anything that isn't "desc" sorts ascending
        ("desc; DROP TABLE x", "ASC"),
    ],
)
def test_order_dir_is_a_two_valued_switch_not_an_interpolation(
    api, fake, order_dir, expected
):
    """``order_dir`` never reaches SQL as user text — it selects one of two words."""
    api.get("/api/matters", query_string={"order_dir": order_dir})
    assert f"ORDER BY date_opened {expected} LIMIT" in fake.sql_log[0]


@pytest.mark.parametrize(
    "order_by",
    ["client_name; DROP TABLE matters", "client_name, (SELECT 1)", "1", "client_name--", "", " "],
)
def test_invalid_order_by_is_rejected_before_any_sql_runs(api, fake, order_by):
    resp = api.get("/api/matters", query_string={"order_by": order_by})

    if order_by == "":
        # Only the empty string is falsy, so it alone falls back to the registry
        # default — the `args.get(...) or entity.order_by` branch. A single
        # space is truthy and must still be rejected as an identifier.
        assert resp.status_code == 200
        return

    assert resp.status_code == 400
    assert resp.get_json()["ok"] is False
    assert fake.sql_log == [], "a rejected sort must not reach InventDB"


# ===========================================================================
# Listing: paging
# ===========================================================================


@pytest.mark.parametrize(
    "limit,expected",
    [
        ("10", 10),
        ("1", 1),
        ("5000", 5000),
        ("0", 1),  # clamped up
        ("-7", 1),
        ("99999", 5000),  # clamped down
        ("", 500),  # empty -> default
    ],
)
def test_limit_is_clamped_to_one_through_five_thousand(api, fake, limit, expected):
    api.get("/api/matters", query_string={"limit": limit})
    assert f"LIMIT {expected} OFFSET" in fake.sql_log[0]


@pytest.mark.parametrize(
    "offset,expected", [("0", 0), ("25", 25), ("-1", 0), ("", 0), ("100000", 100000)]
)
def test_offset_floors_at_zero_and_is_otherwise_unbounded(api, fake, offset, expected):
    api.get("/api/matters", query_string={"offset": offset})
    assert f"OFFSET {expected}" in fake.sql_log[0]


@pytest.mark.parametrize("value", ["abc", "1.5", "10; DROP TABLE x", "1e5"])
@pytest.mark.parametrize("param", ["limit", "offset"])
def test_non_numeric_paging_is_a_client_error(api, fake, param, value):
    resp = api.get("/api/matters", query_string={param: value})
    assert resp.status_code == 400


def test_non_numeric_paging_does_not_leak_the_exception_text(api, fake):
    """The 400 explains what the caller got wrong and nothing else.

    The earlier behaviour was a 500 whose body carried the raw Python message
    ("invalid literal for int() with base 10"), which named our internals to
    anyone who could mistype a query string.
    """
    resp = api.get("/api/matters", query_string={"limit": "abc"})
    assert resp.status_code == 400
    error = resp.get_json()["error"]
    assert "invalid literal" not in error
    assert "limit" in error


def test_a_rejected_page_size_never_reaches_the_database(api, fake):
    """The guard runs before the query is built, so a malformed value cannot
    reach InventDB even as a discarded statement."""
    api.get("/api/matters", query_string={"limit": "10; DROP TABLE x"})
    assert fake.sql_log == []


# ===========================================================================
# Listing: filters — the path user input takes into SQL
# ===========================================================================


def test_arbitrary_query_params_become_equality_filters(api, fake):
    api.get("/api/matters", query_string={"client_name": "Mumbai"})
    assert fake.sql_log[0] == (
        "SELECT * FROM legal.matters WHERE client_name = 'Mumbai' "
        "ORDER BY date_opened ASC LIMIT 500 OFFSET 0"
    )


def test_multiple_filters_are_anded_together(api, fake):
    api.get("/api/matters", query_string={"client_name": "Mumbai", "status": "Occupied"})
    where = fake.sql_log[0].split(" WHERE ")[1].split(" ORDER BY ")[0]
    assert " AND " in where
    assert "client_name = 'Mumbai'" in where
    assert "status = 'Occupied'" in where


def test_the_count_query_reuses_the_same_where_clause(api, fake):
    """`total` must describe the filtered set, not the whole table."""
    api.get("/api/matters", query_string={"client_name": "Mumbai"})
    assert fake.sql_log[1] == (
        "SELECT COUNT(*) AS c FROM legal.matters WHERE client_name = 'Mumbai'"
    )


@pytest.mark.parametrize(
    "param,value",
    [
        ("limit", "5"),
        ("offset", "5"),
        ("order_by", "client_name"),
        ("order_dir", "desc"),
    ],
)
def test_reserved_params_are_not_treated_as_columns(api, fake, param, value):
    api.get("/api/matters", query_string={param: value})
    assert "WHERE" not in fake.sql_log[0]


def test_q_filters_by_search_not_by_a_column_called_q(api, fake):
    """`q` is reserved too, but it is the one that does reach the WHERE.

    It arrives as the search predicate, never as `q = 'mumbai'` — a column of
    that name does not exist and the statement would fail upstream.
    """
    api.get("/api/matters", query_string={"q": "mumbai"})

    page = fake.sql_log[0]
    assert "q = " not in page
    assert page.startswith("SELECT * FROM legal.matters WHERE (")
    assert "LIKE '%mumbai%'" in page


def test_empty_filter_values_are_skipped(api, fake):
    """The UI sends `?status=` for a cleared dropdown; that must not filter."""
    api.get("/api/matters", query_string={"status": ""})
    assert "WHERE" not in fake.sql_log[0]


@pytest.mark.parametrize(
    "value",
    [
        "O'Brien",
        "' OR '1'='1",
        "'; DROP TABLE legal.matters; --",
        "' UNION SELECT * FROM _System.Users --",
        "Mumbai' AND 1=1--",
        "x'||(SELECT 1)||'",
    ],
)
def test_hostile_filter_values_arrive_as_a_single_quoted_literal(api, fake, value):
    """End-to-end proof for the `sqlutil` guarantee: from HTTP query string,
    through the router, into the statement, still inert."""
    api.get("/api/matters", query_string={"client_name": value})

    statement = fake.sql_log[0]
    where = statement.split(" WHERE ")[1].split(" ORDER BY ")[0]
    assert where.startswith("client_name = '") and where.endswith("'")

    literal = where[len("client_name = ") :]
    assert literal.count("'") % 2 == 0
    assert literal[1:-1].replace("''", "").count("'") == 0
    # The clause is the whole WHERE: nothing was appended past the literal.
    assert " ORDER BY date_opened ASC LIMIT 500 OFFSET 0" in statement


@pytest.mark.parametrize(
    "column",
    ["client_name; DROP TABLE x", "client_name--", "1", "client_name)", "*", "client_name OR 1=1", "client_name.sub"],
)
def test_hostile_filter_column_names_are_rejected(api, fake, column):
    resp = api.get("/api/matters", query_string={column: "x"})
    assert resp.status_code == 400
    assert fake.sql_log == []


def test_a_repeated_param_produces_one_clause(api, fake):
    """`?client_name=A&client_name=B` — Flask's `args.get` takes the first; the loop iterates
    unique keys, so exactly one clause is emitted."""
    api.get("/api/matters?client_name=Mumbai&client_name=Delhi")
    where = fake.sql_log[0].split(" WHERE ")[1].split(" ORDER BY ")[0]
    assert where == "client_name = 'Mumbai'"


# ===========================================================================
# Listing: the response envelope and the count fallback
# ===========================================================================


def test_list_returns_rows_with_paging_metadata(api, fake, rows):
    fake.on_sql("SELECT *", rows=rows(3, client_name="Mumbai"))
    fake.on_sql("COUNT(*)", rows=[{"c": 42}])

    body = api.get("/api/matters", query_string={"limit": "3"}).get_json()

    assert len(body["items"]) == 3
    assert body["total"] == 42  # from COUNT, not len(items)
    assert body["limit"] == 3
    assert body["offset"] == 0


@pytest.mark.parametrize(
    "count_rows,expected",
    [
        ([{"c": 7}], 7),
        ([{"COUNT(*)": 7}], 7),
        ([{"count": 7}], 7),
        ([{"anything_else": 7}], 7),  # falls back to the first coercible value
        ([{"c": "7"}], 7),
        ([{"c": None}], 0),
        ([{"c": "not a number"}], 0),
        ([{}], 0),
        ([], 0),
    ],
)
def test_count_tolerates_every_shape_inventdb_might_name_the_column(
    api, fake, count_rows, expected
):
    """Aggregate columns are not guaranteed to keep an `AS` alias, so the
    column can come back as `c`, `COUNT(*)` or something else entirely."""
    fake.on_sql("COUNT(*)", rows=count_rows)
    assert api.get("/api/matters").get_json()["total"] == expected


def test_a_failing_count_degrades_to_zero_rather_than_failing_the_request(api, fake):
    """A type with no rows yet surfaces as an SQL error on a fresh instance;
    the list must still render."""
    fake.on_sql("COUNT(*)", status=500, payload={"error": "no such table"})

    resp = api.get("/api/matters")

    assert resp.status_code == 200
    assert resp.get_json()["total"] == 0


def test_a_failing_page_query_returns_an_empty_list_not_an_error(api, fake):
    fake.on_sql("SELECT *", status=500, payload={"error": "no such table"})

    body = api.get("/api/matters").get_json()

    assert body["items"] == []


# ===========================================================================
# Listing: the free-text search path
# ===========================================================================


def test_search_pushes_the_match_into_sql_rather_than_filtering_a_page(api, fake):
    """Free text becomes an OR of LIKEs, not a Python scan of a fetched page.

    A statement comes back as a bounded page. Filtering a fetched page here
    would search the first page of 34,000 time entries and report the result as
    the whole table — not a slow answer, a wrong one.
    """
    fake.on_sql("SELECT *", rows=[{"_id": "1", "matter_caption": "Zhang v. Pineda"}])

    body = api.get("/api/matters", query_string={"q": "zhang"}).get_json()

    page, count = fake.sql_log
    assert page.startswith("SELECT * FROM legal.matters WHERE (")
    assert "matter_caption LIKE '%zhang%' ESCAPE '\\'" in page
    assert page.endswith("ORDER BY date_opened ASC LIMIT 500 OFFSET 0")
    # The count carries the same predicate, so `total` counts matches upstream
    # rather than counting the page that came back.
    assert count.startswith("SELECT COUNT(*) AS c FROM legal.matters WHERE (")
    assert "matter_caption LIKE '%zhang%'" in count
    assert [r["_id"] for r in body["items"]] == ["1"]


def test_search_covers_every_declared_search_field(api, fake):
    api.get("/api/matters", query_string={"q": "zhang"})

    where = fake.sql_log[0]
    for column in get_entity("matters").search_fields:
        assert f"{column} LIKE '%zhang%'" in where
    # …and only those: a column off the list must not be searched, or "search"
    # silently becomes "search everything".
    assert "fee_terms LIKE" not in where


def test_search_terms_are_escaped_into_a_single_literal(api, fake):
    api.get("/api/matters", query_string={"q": "O'Brien"})
    page = fake.sql_log[0]
    assert "'%O''Brien%'" in page
    assert page.count("WHERE") == 1


def test_search_wildcards_are_matched_literally(api, fake):
    """A search for "100%" looks for that text, not for every row."""
    api.get("/api/matters", query_string={"q": "100%"})
    assert "'%100\\%%' ESCAPE '\\'" in fake.sql_log[0]


def test_search_paginates_with_limit_and_offset_upstream(api, fake):
    api.get(
        "/api/matters", query_string={"q": "zhang", "limit": "3", "offset": "6"}
    )
    assert fake.sql_log[0].endswith("LIMIT 3 OFFSET 6")


def test_search_combines_with_column_filters_in_sql(api, fake):
    fake.on_sql("SELECT *", rows=[{"_id": "1", "client_name": "Zhang, Wei"}])
    api.get("/api/matters", query_string={"q": "zhang", "status": "Open"})

    page = fake.sql_log[0]
    assert page.startswith("SELECT * FROM legal.matters WHERE status = 'Open' AND (")
    assert "client_name LIKE '%zhang%'" in page


def test_search_over_an_empty_table_returns_an_empty_page(api, fake):
    fake.on_sql("SELECT *", rows=[])

    body = api.get("/api/matters", query_string={"q": "x"}).get_json()

    assert body == {"items": [], "total": 0, "limit": 500, "offset": 0}


def test_search_falls_back_to_the_fetched_page_when_an_entity_declares_none(
    api, fake, monkeypatch
):
    """The `list(rows[0].keys())` branch in `list_records`.

    Unreachable through the HTTP surface today — every registered entity
    declares `search_fields` — so it is exercised by emptying one rather than
    left untested on the assumption it works.
    """
    # `Entity` is frozen, so the registry lookup is swapped rather than mutated.
    bare = replace(get_entity("matters"), search_fields=[])
    monkeypatch.setattr("app.routers.resources.get_entity", lambda name: bare)
    fake.on_sql(
        "SELECT *",
        rows=[{"_id": "1", "undeclared": "findme"}, {"_id": "2", "undeclared": "no"}],
    )

    body = api.get("/api/matters", query_string={"q": "findme"}).get_json()

    assert "LIKE" not in fake.sql_log[0]
    assert [r["_id"] for r in body["items"]] == ["1"]
    assert body["total"] == 1


def test_matches_q_reads_only_the_columns_it_is_given():
    row = {"_id": "1", "undeclared_column": "findme"}
    assert _matches_q(row, "findme", list(row.keys())) is True
    assert _matches_q(row, "findme", ["_id"]) is False


# ===========================================================================
# Routing, entity resolution and auth
# ===========================================================================


@pytest.mark.parametrize(
    "entity",
    [
        "matters",
        "clients",
        "timekeepers",
        "invoices",
        "time_entries",
        "costs_and_disbursements",
        "payments_and_receipts",
        "court_calendar",
        "deadlines_and_sol",
        "lookups",
    ],
)
def test_every_registered_entity_is_listable(api, fake, entity):
    resp = api.get(f"/api/{entity}")
    assert resp.status_code == 200
    assert fake.sql_log[0].startswith(f"SELECT * FROM legal.{entity}")


@pytest.mark.parametrize(
    "entity", ["nope", "Matters", "properties2", "_System", "users"]
)
def test_unknown_entities_are_404_and_never_reach_inventdb(api, fake, entity):
    """The registry is an allow-list — this is what stops `/api/<anything>`
    from becoming a read primitive over the whole namespace."""
    resp = api.get(f"/api/{entity}")
    assert resp.status_code == 404
    assert fake.calls == []


def test_the_entity_check_runs_before_the_auth_check(api, fake):
    """Documents ordering: an unknown entity is 404 even unauthenticated.

    That leaks the entity list to anonymous callers. Harmless here — the names
    are already public in `/api/meta/entities` — but worth being deliberate about.
    """
    assert api.get("/api/nope", token=None).status_code == 404


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/matters"),
        ("GET", "/api/matters/abc"),
        ("POST", "/api/matters"),
        ("PUT", "/api/matters/abc"),
        ("DELETE", "/api/matters/abc"),
    ],
)
def test_every_crud_route_requires_a_bearer_token(api, fake, method, path):
    resp = api._open(method, path, token=None, json={})
    assert resp.status_code == 401
    assert fake.calls == []


@pytest.mark.parametrize(
    "header",
    ["", "Bearer", "Bearer ", "Basic abc123", "token abc123", "Bearer  ", "abc123"],
)
def test_malformed_authorization_headers_are_rejected(client, fake, header):
    resp = client.get("/api/matters", headers={"Authorization": header})
    assert resp.status_code == 401
    assert fake.calls == []


def test_the_callers_token_is_forwarded_verbatim(api, fake):
    """InventDB enforces row-level security off this token, so the backend must
    pass the caller's own credential rather than a service account."""
    api.get("/api/matters", token="caller-jwt-xyz")
    assert fake.calls[0].token == "caller-jwt-xyz"


@pytest.mark.parametrize("scheme", ["bearer", "BEARER", "BeArEr"])
def test_the_bearer_scheme_is_case_insensitive(client, fake, scheme):
    resp = client.get("/api/matters", headers={"Authorization": f"{scheme} tok"})
    assert resp.status_code == 200


# ===========================================================================
# Reading one record
# ===========================================================================


def test_get_record_proxies_to_the_record_endpoint(api, fake):
    fake.on_record("matters", "abc-123", {"_id": "abc-123", "client_name": "Mumbai"})

    body = api.get("/api/matters/abc-123").get_json()

    assert body["client_name"] == "Mumbai"
    assert fake.last_call("GET").path == "/db/legal/matters/abc-123"


def test_an_upstream_404_is_passed_through_with_its_status(api, fake):
    fake.on(
        "GET",
        "/db/legal/matters/missing",
        {"error": "No such record"},
        status=404,
    )

    resp = api.get("/api/matters/missing")

    assert resp.status_code == 404
    assert resp.get_json() == {"ok": False, "error": "No such record"}


# ===========================================================================
# Create
# ===========================================================================


def test_create_posts_the_body_to_the_record_endpoint(api, fake):
    api.post("/api/matters", json={"client_name": "Mumbai", "matter_id": "P-001"})

    call = fake.last_call("POST", "/db/legal/matters")
    assert call.body["client_name"] == "Mumbai"
    assert call.body["matter_id"] == "P-001"


def test_create_strips_underscore_prefixed_fields(api, fake):
    """`_id`, `_created` and friends are InventDB's to set; echoing a client's
    values back would let a caller overwrite system metadata."""
    api.post(
        "/api/matters",
        json={"client_name": "Mumbai", "_id": "forged", "_created": "1999", "__proto__": "x"},
    )

    body = fake.last_call("POST", "/db/legal/matters").body
    assert not [k for k in body if k.startswith("_")]


def test_create_generates_the_business_key_when_absent(api, fake):
    api.post("/api/matters", json={"client_name": "Mumbai"})

    generated = fake.last_call("POST", "/db/legal/matters").body["matter_id"]
    assert generated.startswith("MT-")
    assert len(generated) == len("MT-") + 8


def test_create_does_not_overwrite_a_supplied_key(api, fake):
    api.post("/api/matters", json={"matter_id": "P-EXISTING"})
    assert fake.last_call("POST", "/db/legal/matters").body["matter_id"] == "P-EXISTING"


@pytest.mark.parametrize(
    "entity,prefix",
    [
        ("matters", "MT"),
        ("clients", "CL"),
        ("timekeepers", "TK"),
        ("time_entries", "TE"),
        ("costs_and_disbursements", "CO"),
        ("invoices", "INV"),
        ("payments_and_receipts", "PY"),
        ("trust_ledger_cta", "TR"),
        ("court_calendar", "EV"),
        ("deadlines_and_sol", "DL"),
        ("intake_and_leads", "LD"),
        ("settlements_and_liens", "ST"),
        ("lookups", "LK"),
    ],
)
def test_generated_keys_use_the_documented_prefix(entity, prefix):
    key = _gen_key(get_entity(entity))
    # Uppercase hex, checked by pattern rather than `.isupper()` — an all-digit
    # suffix is a perfectly good key but is not "upper".
    assert re.fullmatch(rf"{prefix}-[0-9A-F]{{8}}", key), key


def test_generated_keys_are_unique():
    keys = {_gen_key(get_entity("matters")) for _ in range(500)}
    assert len(keys) == 500


def test_create_refetches_the_stored_record_so_system_fields_come_back(api, fake):
    """The client needs InventDB's `_id` to edit or delete the row it just made."""
    fake.on("POST", "/db/legal/matters", {"id": "srv-1"})
    fake.on_record("matters", "srv-1", {"_id": "srv-1", "client_name": "Mumbai", "_v": 1})

    resp = api.post("/api/matters", json={"client_name": "Mumbai"})

    assert resp.status_code == 201
    assert resp.get_json() == {"_id": "srv-1", "client_name": "Mumbai", "_v": 1}


def test_create_falls_back_to_the_submitted_data_if_the_refetch_fails(api, fake):
    fake.on("POST", "/db/legal/matters", {"id": "srv-1"})
    fake.on("GET", "/db/legal/matters/srv-1", {"error": "gone"}, status=404)

    resp = api.post("/api/matters", json={"client_name": "Mumbai"})
    body = resp.get_json()

    assert resp.status_code == 201
    assert body["client_name"] == "Mumbai"
    assert body["ok"] is True


def test_create_reports_a_null_id_when_inventdb_returns_none(api, fake):
    resp = api.post("/api/matters", json={"client_name": "Mumbai"})
    assert resp.status_code == 201
    assert resp.get_json()["_id"] is None


@pytest.mark.parametrize("body", ["[]", '"a string"', "12", "null", "not json at all"])
def test_create_rejects_a_non_object_body(api, fake, body):
    resp = api.post(
        "/api/matters", data=body, content_type="application/json"
    )
    assert resp.status_code == 400
    assert fake.calls == []


def test_create_propagates_an_upstream_validation_error(api, fake):
    fake.on("POST", "/db/legal/matters", {"error": "amount must be numeric"}, status=422)

    resp = api.post("/api/matters", json={"client_name": "Mumbai"})

    assert resp.status_code == 422
    assert resp.get_json()["error"] == "amount must be numeric"


# ===========================================================================
# Update — the read-merge-write cycle
# ===========================================================================


def test_update_merges_onto_the_stored_record(api, fake):
    """The edit form only submits the fields it renders. Without the merge, a
    PUT that replaces rather than patches would silently drop every other
    column — which is why the router reads first."""
    fake.on_record(
        "matters",
        "abc",
        {
            "_id": "abc",
            "matter_id": "P-001",
            "client_name": "Mumbai",
            "state": "MH",
            "notes": "keep me",
        },
    )

    api.put("/api/matters/abc", json={"client_name": "Delhi"})

    sent = fake.last_call("PUT", "/db/legal/matters").body
    assert sent["client_name"] == "Delhi"  # the edit
    assert sent["state"] == "MH"  # untouched column survives
    assert sent["notes"] == "keep me"
    assert sent["matter_id"] == "P-001"  # business key survives


def test_update_targets_the_record_by_id(api, fake):
    fake.on_record("matters", "abc", {"_id": "abc", "matter_id": "P-001"})
    api.put("/api/matters/abc", json={"client_name": "Delhi"})
    assert fake.last_call("PUT", "/db/legal/matters").body["_id"] == "abc"


def test_update_ignores_a_client_supplied_id(api, fake):
    """A caller must not be able to redirect the write at another row."""
    fake.on_record("matters", "abc", {"_id": "abc", "matter_id": "P-001"})

    api.put("/api/matters/abc", json={"_id": "somebody-elses-row", "client_name": "Delhi"})

    assert fake.last_call("PUT", "/db/legal/matters").body["_id"] == "abc"


def test_update_drops_system_fields_from_the_existing_record_too(api, fake):
    """Only `_id` is re-attached; other InventDB metadata is not echoed back."""
    fake.on_record(
        "matters",
        "abc",
        {"_id": "abc", "_created": "2024-01-01", "_v": 3, "matter_id": "P-001"},
    )

    sent = (api.put("/api/matters/abc", json={"client_name": "Delhi"}), fake)[1].last_call(
        "PUT", "/db/legal/matters"
    ).body

    assert set(k for k in sent if k.startswith("_")) == {"_id"}


def test_update_still_writes_when_the_record_cannot_be_read_first(api, fake):
    """A read failure must not block the edit — the merge is best-effort."""
    fake.on("GET", "/db/legal/matters/abc", {"error": "transient"}, status=503)

    api.put("/api/matters/abc", json={"client_name": "Delhi"})

    sent = fake.last_call("PUT", "/db/legal/matters").body
    assert sent["client_name"] == "Delhi"
    assert sent["_id"] == "abc"


def test_update_mints_a_business_key_if_the_merge_produced_none(api, fake):
    fake.on("GET", "/db/legal/matters/abc", {"error": "gone"}, status=404)

    api.put("/api/matters/abc", json={"client_name": "Delhi"})

    assert fake.last_call("PUT", "/db/legal/matters").body["matter_id"].startswith("MT-")


def test_update_returns_the_refetched_record(api, fake):
    calls = {"n": 0}

    def _record(_call):
        from tests.fake_inventdb import Reply

        calls["n"] += 1
        client_name = "Mumbai" if calls["n"] == 1 else "Delhi"
        return Reply(200, {"_id": "abc", "client_name": client_name, "matter_id": "P-001"})

    fake.on("GET", "/db/legal/matters/abc", None)
    fake._rules[-1].responder = _record

    body = api.put("/api/matters/abc", json={"client_name": "Delhi"}).get_json()

    assert body["client_name"] == "Delhi"
    assert calls["n"] == 2  # read for the merge, then read back


def test_update_falls_back_to_the_merged_document_if_the_readback_fails(api, fake):
    fake.on("GET", "/db/legal/matters/abc", {"error": "gone"}, status=404)

    body = api.put("/api/matters/abc", json={"client_name": "Delhi"}).get_json()

    assert body["client_name"] == "Delhi"
    assert body["ok"] is True


def test_update_propagates_an_upstream_write_failure(api, fake):
    fake.on_record("matters", "abc", {"_id": "abc", "matter_id": "P-001"})
    fake.on("PUT", "/db/legal/matters", {"error": "read-only"}, status=403)

    resp = api.put("/api/matters/abc", json={"client_name": "Delhi"})

    assert resp.status_code == 403


@pytest.mark.parametrize("body", ["[]", "null", "7"])
def test_update_rejects_a_non_object_body(api, fake, body):
    resp = api.put("/api/matters/abc", data=body, content_type="application/json")
    assert resp.status_code == 400
    assert fake.calls == []


# ===========================================================================
# Delete
# ===========================================================================


def test_delete_calls_the_record_endpoint_and_echoes_the_id(api, fake):
    resp = api.delete("/api/matters/abc-123")

    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True, "id": "abc-123"}
    assert fake.last_call("DELETE").path == "/db/legal/matters/abc-123"


def test_delete_propagates_an_upstream_refusal(api, fake):
    fake.on(
        "DELETE",
        "/db/legal/matters/abc",
        {"error": "referenced by 3 invoices"},
        status=409,
    )

    resp = api.delete("/api/matters/abc")

    assert resp.status_code == 409
    assert resp.get_json()["error"] == "referenced by 3 invoices"


def test_delete_on_an_unknown_entity_never_reaches_inventdb(api, fake):
    assert api.delete("/api/nope/abc").status_code == 404
    assert fake.calls == []
