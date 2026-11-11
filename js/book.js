// English A (textbook) and English B (grammar).
// Content is copied word for word from the notes PDFs. Nothing here is written by hand from memory.
//
// To add a chapter, push an object like this into the right list:
//
//   {
//     id: "unit-1",                       // used in the link: /#/a/unit-1
//     no: "Unit 1",                       // small label shown before the title
//     title: "Chapter title",
//     sections: [
//       { title: "Summary", kind: "text", paras: ["First paragraph.", "Second paragraph."] },
//       { title: "Questions and answers", kind: "qa", items: [{ q: "Question?", a: "Answer." }] },
//       { title: "Words and meanings", kind: "table", head: ["Word", "Meaning"], rows: [["word", "meaning"]] },
//       { title: "Key points", kind: "list", items: ["Point one", "Point two"] },
//     ],
//   }
//
// Add  urdu: true  to a section whose text is in Urdu.

//   { title: "Exercise 1", kind: "pairs", items: [{ en: "English sentence.", ur: "اردو جملہ۔" }] }   // Urdu with its English
//
// A long chapter can live in its own file under js/book/ and be imported here.
import tenses from "./book/tenses.js";
import pastTenses from "./book/past-tenses.js";
import futureTenses from "./book/future-tenses.js";

export const ENGLISH_A = {
  key: "a",
  name: "English A",
  label: "Textbook",
  about: "Every chapter of the book with its summary and question answers",
  chapters: [],
};

export const ENGLISH_B = {
  key: "b",
  name: "English B",
  label: "Grammar",
  about: "Grammar topics with rules and examples",
  chapters: [tenses, pastTenses, futureTenses],
};
