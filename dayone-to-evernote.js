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
    return new ProgressBar('╢:bar╟ :current/:total  :percent  elapsed: :elapseds  eta: :etas', {
        complete: '▋',
        incomplete: '░',
        width: 50,
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

function main(argv) {
    var program = require('commander');
    program
        .version('0.0.1')
        .usage("<Journal_dayone_dir>")
        .arguments('<Journal_dayone_dir>')
        .parse(argv);
    if (!program.args.length) program.help();

    var notebookName = `Dayone: ${new Date().toDateString()}`;
    var doPath = program.args[0];
    var entriesPath = getEntriesPath(doPath);

    var fs = require('fs');
    var entriesDir = fs.readdirSync(entriesPath);
    var bar = initProgressBar(entriesDir.length);
    require('async-foreach').forEach(entriesDir, function (filename) {
        bar.tick(1);
        var done = this.async();
        var doJsonFilePath = prepareDoJsonFile(doPath, filename);
        try {
            var shellCmd = `${__dirname}/create-EN-note-mac.js '${doJsonFilePath}' '${notebookName}'`;
            require('child_process').execSync(shellCmd, { stdio: [0, 1, 2] });
        } catch (e) {
            console.log(e);
        } finally {
            fs.unlinkSync(doJsonFilePath);
            setImmediate(done);
        }
    });
}

if (typeof require != 'undefined' && require.main == module) {
    main(process.argv);
}
