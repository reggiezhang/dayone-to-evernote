#!/usr/bin/env osascript -l JavaScript

/*
 * create-EN-note-mac.js <note.json> <notebookName> [noteTitle]
 * Copyright (C) 2017 Reggie Zhang <reggy.zhang@gmail.com>
 * Licensed under the terms of The GNU Lesser General Public License (LGPLv3):
 * http://www.opensource.org/licenses/lgpl-3.0.html
 * 
 */
"use strict";

var EN = Application("Evernote");
EN.includeStandardAdditions = true;

var app = Application.currentApplication();
app.includeStandardAdditions = true;

function getNote(filePath) {
    var path = Path(filePath);
    var file = app.openForAccess(path, { writePermission: false });
    var noteObj;
    if (app.getEof(file) > 0) {
        noteObj = JSON.parse($.NSString.alloc.initWithUTF8String(app.read(file)).cString);
    }
    return noteObj;
}

function getNoteTitle(titleParam, noteText) {
    var noteTitle = titleParam;
    if (noteTitle == undefined) {
        var notes = noteText.split('\n');
        noteTitle = notes[0];
    }
    return noteTitle;
}

function createNotebook(name) {
    if (!findNotebook(name)) {
        EN.createNotebook(name, {withType: "local only"});
        console.log("Notebook created: %s", name);
    }
}
function findNotebook(name) {
    return EN.notebooks().find(function (elem) {
        return elem.name() === name;
    });
}

function getPhotoArray(photoPathStr) {
    var photoArr = new Array();
    if (photoPathStr != undefined) {
        photoArr[photoArr.length] = Path(photoPathStr);
    }
    return photoArr;
}
function run(argv) {
    var doNote = getNote(argv[0])   // first argument:  note.json path
    var notebookName = argv[1];     // second argument: notebookName
    var noteTitle = argv[2];        // third argument:  noteTitle

    var params = new Object();
    params.withText = doNote['Entry Text'];
    params.title = getNoteTitle(noteTitle, params.withText); 
    params.notebook = notebookName;
    params.tags = doNote['Tags'];
    params.created = new Date(doNote['Creation Date']);
    params.attachments = getPhotoArray(doNote['Photo Path']);

    try {
        createNotebook(notebookName);
        EN.createNote(params);
        console.log("Note created: %s", doNote['UUID']);
    } catch (e) {
        console.log(e);
    }
}
