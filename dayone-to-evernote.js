#!/usr/bin/env node
/*
 * dayone-to-evernote.js
 * Copyright (C) 2017 Reggie Zhang <reggy.zhang@gmail.com>
 * Licensed under the terms of The GNU Lesser General Public License (LGPLv3):
 * http://www.opensource.org/licenses/lgpl-3.0.html
 *
 */

function getEntriesPath(doPath) {
    return `${doPath}/entries/`;
}

function getPhotosPath(doPath) {
    return `${doPath}/photos/`;
}

function initProgressBar(totalLength) {
    var ProgressBar = require('progress');
    console.log();
    return new ProgressBar(':percent|:bar|  :current/:total  elapsed: :elapseds  eta: :etas', {
        complete: '█',
        incomplete: ' ',
        width: 40,
        total: totalLength
    });
}

function prepareDoJsonFile(doPath, filename) {
    var fs = require('fs');
    var plist = require('plist');
    var obj = plist.parse(fs.readFileSync(`${getEntriesPath(doPath)}/${filename}`, 'utf8'));
    var doJsonFilePath = `${require('os').tmpdir()}/${obj['UUID']}.json`;
    var photoPath = `${getPhotosPath(doPath)}${obj['UUID']}.jpg`;
    if (fs.existsSync(photoPath)) obj['Photo Path'] = photoPath;
    if (obj['Tags'] == undefined) obj['Tags'] = new Array();
    obj['Tags'][obj['Tags'].length] = 'dayone';
    fs.writeFileSync(doJsonFilePath, JSON.stringify(obj));
    return doJsonFilePath;
}

function getDoNote(doPath, filename) {
    const fs = require('fs');
    const plist = require('plist');
    var doNote = plist.parse(fs.readFileSync(`${getEntriesPath(doPath)}/${filename}`, 'utf8'));
    var photoPath = `${getPhotosPath(doPath)}${doNote['UUID']}.jpg`;
    if (fs.existsSync(photoPath)) doNote['Photo Path'] = photoPath;
    if (doNote['Tags'] == undefined) doNote['Tags'] = new Array();
    doNote['Tags'][doNote['Tags'].length] = 'dayone';
    return doNote;
}

function preparePrarmsFile(doPath, filename, notebookName) {
    var doNote = getDoNote(doPath, filename);
    var params = new Object();
    params.withText = doNote['Entry Text'];
    params.title = getNoteTitle(params.withText);
    params.notebook = notebookName;
    params.tags = doNote['Tags'];
    params.created = new Date(doNote['Creation Date']);
    if (doNote['Photo Path']) {
        params.attachments = [doNote['Photo Path']];
    }

    const uuidV4 = require('uuid/v4');
    const fs = require('fs');
    const os = require('os');
    var paramsFilePath = `${os.tmpdir()}/${uuidV4()}.json`;
    fs.writeFileSync(paramsFilePath, JSON.stringify(params));
    return paramsFilePath;
}

function getNoteTitle(noteText) {
    return noteText.split('\n')[0];
}

function getEntries(doPath, afterDate) {
    var entriesPath = getEntriesPath(doPath);
    var entriesDir = require('fs').readdirSync(entriesPath);
    if (afterDate === undefined) return entriesDir;
    var entries = entriesDir.filter(function (item) {
        var fs = require('fs');
        var plist = require('plist');
        var obj = plist.parse(fs.readFileSync(`${getEntriesPath(doPath)}/${item}`, 'utf8'));
        var noteDate = new Date(obj['Creation Date']);
        return noteDate > afterDate;
    });
    return entries;
}

function main(argv) {
    const evernote = require('evernote-jxa');
    var program = require('commander');
    require('pkginfo')(module, 'version');
    program
        .version(module.exports.version)
        .option('-a, --after <date>', 'date with ISO8601 format. e.g. 2016-05-10T03:08:07+08:00', Date.parse)
        .arguments('<Journal_dayone_dir>')
        .parse(argv);
    if (!program.args.length
        || program.after !== undefined && isNaN(program.after)) program.help();

    var notebookName = `Dayone: ${new Date().toDateString()}`;
    var doPath = program.args[0];
    var entriesPath = getEntriesPath(doPath);

    var fs = require('fs');
    var entries = getEntries(doPath, program.after);
    var bar = initProgressBar(entries.length);
    evernote.createNotebook(notebookName);
    require('async-foreach').forEach(entries, function (filename) {
        bar.tick(1);
        var done = this.async();
        var paramsFilePath = preparePrarmsFile(doPath, filename, notebookName);
        try {
            evernote.createNote(paramsFilePath)
        } catch (e) {
            console.log(e);
        } finally {
            fs.unlinkSync(paramsFilePath);
            setImmediate(done);
        }
    });
}

if (typeof require != 'undefined' && require.main == module) {
    main(process.argv);
}
