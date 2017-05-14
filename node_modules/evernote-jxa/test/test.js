#!/usr/bin/env node
var enJxa = require('../evernote-jxa');


console.log("Notebook created: " + enJxa.createNotebook('evernote-jxa-test'));
var createdNoteId = enJxa.createNote('./testParamWithAttachment.json');
console.log("note created: %s", createdNoteId);
var notebookName = enJxa.deleteNote(createdNoteId);

console.log('delete it from: ' + notebookName);

console.log(`note still exists: ${enJxa.deleteNote(createdNoteId) !== null}`);

console.log("Found notebook: " + enJxa.findNotebook(notebookName));
console.log('notebook deleted: ' + enJxa.deleteNotebook(notebookName));