#!/usr/bin/env node
/*
 * dayone-to-evernote-mac.js
 * Copyright (C) 2017 Reggie Zhang <reggy.zhang@gmail.com>
 * Licensed under the terms of The GNU Lesser General Public License (LGPLv3):
 * http://www.opensource.org/licenses/lgpl-3.0.html
 *
 */

function initProgressBar(totalLength) {
    var ProgressBar = require('progress');
    console.log();
    return new ProgressBar('Importing [:bar] :current/:total  :percent  elapsed: :elapseds  eta: :etas', {
        complete: '=',
        incomplete: ' ',
        width: 40,
        total: totalLength
    });
}

function prepareDoJsonFile(doPath, filename) {
    var fs = require('fs');
    var plist = require('plist');
    var obj = plist.parse(fs.readFileSync(`${doPath}/entries/${filename}`, 'utf8'));
    var doJsonFilePath = `${require('os').tmpdir()}/${obj['UUID']}.json`;
    var photoPath = `${doPath}/photos/${obj['UUID']}.jpg`;
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
    var journalsDir = program.args[0];
    var entriesPath = `${journalsDir}/entries/`;

    var fs = require('fs');
    var files = fs.readdirSync(entriesPath);
    var bar = initProgressBar(files.length);
    require('async-foreach').forEach(files, function (filename) {
        var done = this.async();
        var doJsonFilePath = prepareDoJsonFile(journalsDir, filename);
        try {
            var shellCmd = `${__dirname}/create-EN-note-mac.js '${doJsonFilePath}' '${notebookName}'`;
            require('child_process').execSync(shellCmd, { stdio: [0, 1, 2] });
        } catch (e) {
            console.log(e);
        } finally {
            fs.unlinkSync(doJsonFilePath);
            setTimeout(done, 1);
            bar.tick(1);
        }
    });
}

if (typeof require != 'undefined' && require.main == module) {
    main(process.argv);
}
