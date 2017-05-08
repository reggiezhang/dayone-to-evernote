#!/usr/bin/env node
/*
 * dayone-to-evernote-mac.js 
 * Copyright (C) 2017 Reggie Zhang <reggy.zhang@gmail.com>
 * Licensed under the terms of The GNU Lesser General Public License (LGPLv3):
 * http://www.opensource.org/licenses/lgpl-3.0.html
 * 
 */

console.time("dayone-to-evernote-mac.js")

/*
0: /usr/local/Cellar/node/7.10.0/bin/node
1: /Users/i070159/scripts/dayone-to-evernote-mac.js
2: /Users/i070159/Desktop/Journal_dayone@20170506/
*/

if (process.argv.length < 3) {
    console.log("usage: dayone-to-evernote-mac.js  <dayone_folder>");
    return;
}

function plist2json(plistPath) {
    return plist.parse(fs.readFileSync(plistPath, 'utf8'));
}

var DAYONE_DIR = process.argv[2]; //'/Users/i070159/Desktop/Journal_dayone@20170506/';

var notebookName = 'Dayone: ' + new Date().toDateString();

var fs = require('fs');
var plist = require('plist');
var execSync = require('child_process').execSync;
var entriesPath = DAYONE_DIR + '/entries/';
var photosPath = DAYONE_DIR + '/photos/';
var files = fs.readdirSync(entriesPath);

var count = 0;
files.forEach(function (filename) {
    var obj = plist2json(entriesPath + filename);
    var noteTempFilePath =`${__dirname}/${obj['UUID']}.json`;
    var photoPath = photosPath + obj['UUID'] + '.jpg';
    if (fs.existsSync(photoPath)) {
        obj['Photo Path'] = photosPath + obj['UUID'] + '.jpg';
    }
    if (obj['Tags'] == undefined) {
        obj['Tags'] = ['dayone'];
    } else {
        obj['Tags'][obj['Tags'].length] = 'dayone';
    }
    fs.writeFileSync(noteTempFilePath, JSON.stringify(obj));
    try {
        var shellCmd = `${__dirname}/create-EN-note-mac.js '${noteTempFilePath}' '${notebookName}' `;
        execSync(shellCmd, { stdio: [0, 1, 2] });
        count++;

    } catch (e) {
        console.log(e);
    } finally {
        fs.unlinkSync(noteTempFilePath);
    }
});

console.log("%d Notes created.", count);
console.timeEnd("dayone-to-evernote-mac.js");
