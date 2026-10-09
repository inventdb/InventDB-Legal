# Test documents

1,000 litigation documents for **Alvarado & Sung LLP**, the firm whose practice data is in
[`CA_Litigation_Practice_Dataset.xlsx`](../CA_Litigation_Practice_Dataset.xlsx). They are what
the Files room, file search and Analyze's file citations are tested against.

Everything here is synthetic. The firm, its clients and its cases are invented, each document
is generated from the workbook's own rows, and every e-mail address is on `mailinator.com`.

## Layout

`Alvarado & Sung LLP/` is the firm's file share, kept the way a litigation practice keeps it:
one folder per client, one per matter, and inside each matter a numbered folder per kind of paper.

```
Alvarado & Sung LLP/
├── Clients/                                  448 clients
│   └── <Client>/                             individuals "Last, First"; entities by name
│       └── <Matter no.> <Caption>/           623 matters in all
│           ├── 01 Intake & Engagement        fee agreements, intake memos
│           ├── 02 Pleadings                  complaints, petitions
│           ├── 03 Discovery                  deposition notices
│           ├── 04 Court Orders               minute orders
│           ├── 05 Deadlines                  docketing memos
│           ├── 06 Experts                    retention letters
│           ├── 07 Settlement                 demands, settlement agreements, disbursement statements
│           ├── 08 Liens                      lien reduction requests
│           ├── 09 Billing                    statements of account
│           └── 10 Trust Account              client trust ledgers
└── Prospective Clients/                      30 leads the firm did not take on
    └── <Lead no.> <Prospect>/                non-engagement letters, intake memos
```

A matter only has the folders it has papers for.

## File names

```
<date> <document> - <client> - <matter or lead no.> - <attorney>.pdf
2025-06-24 Fee Agreement - Alcaraz - MT-2599 - Raghunathan.pdf
2026-03-09 Depo Notice - PMQ Downey Fleet - Bagramyan Construction - MT-2292 - Nazarian.pdf
```

- **date**: the document's own date, so a folder sorts in the order things happened. That is
  the letter date, the date a pleading or notice was signed, the hearing date of a minute
  order, an invoice's issue date, or a trust ledger's last entry.
- **document**: what it is, with the detail that tells two of a kind apart: the deponent, the
  proceeding, the lienholder, the expert, the invoice number, the deadline.
- **client**: an individual by surname, an entity by the short name its captions use.
- **attorney**: the matter's responsible attorney. That is the attorney who signs the letters
  and is named on the pleadings; every document that names one names that attorney. A
  prospective client has none, so its papers carry the attorney who signed them, or else the
  managing partner who supervises intake.

Every name was taken from the document's text, not from where the file came from. The matter
was resolved from markers in the text: file number, case number, claim number, invoice number,
lead number, expert and retainer, or patient and settlement. It was then checked against the
workbook. Every name is unique across the set, and no path exceeds 225 characters, so a clone
fits within Windows' 260-character limit.

Some documents are odd, the way generated ones can be: a few trademark matters hold a
"complaint", and a few lien letters are addressed to "No lien asserted". Their names say what
the paper says.

## Using them

To load the whole set into an InventDB workspace, use SOAR's **Files** room: **Upload folder**,
choose `Alvarado & Sung LLP`, and send it to `legal.documents`. Each file keeps its folder
path, root included. The app's own **Files** room (`/files`) has the same **Upload folder**.
