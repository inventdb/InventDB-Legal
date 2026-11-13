// The app's own type: Source Serif 4 for headings, IBM Plex for everything else.
import { loadFont as loadSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as loadSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

export const SERIF = loadSerif("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
loadSerif("italic", { weights: ["500"], subsets: ["latin"] });
export const SANS = loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
export const MONO = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
