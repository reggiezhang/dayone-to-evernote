#!/usr/bin/env node
/*
 * dayone-to-evernote-mac.js 
 * Copyright (C) 2017 Reggie Zhang <reggy.zhang@gmail.com>
 * Licensed under the terms of The GNU Lesser General Public License (LGPLv3):
 * http://www.opensource.org/licenses/lgpl-3.0.html
 * 
 */

function main(argv) {
    var program = require('commander');

    program
        .version('0.0.1')
        .option('-d, --dir', 'Day One Classic Journals folder')
        .parse(argv);
    if (!program.args.length) program.help();
    
    var DAYONE_DIR = argv[2];
    var notebookName = 'Dayone: ' + new Date().toDateString();
    var fs = require('fs');
    var plist = require('plist');
    var execSync = require('child_process').execSync;
    var entriesPath = DAYONE_DIR + '/entries/';
    var photosPath = DAYONE_DIR + '/photos/';
    var files = fs.readdirSync(entriesPath);
    var ProgressBar = require('progress');
    var bar = new ProgressBar('Importing [:bar] :current/:total  :percent  elapsed: :elapseds  eta: :etas', {
        complete: '=',
        incomplete: ' ',
        width: 40,
        total: files.length
    });

    var forEach = require('async-foreach').forEach;
    forEach(files, function (filename) {
        var done = this.async();
        var obj = plist.parse(fs.readFileSync(entriesPath + filename, 'utf8'));
        var noteTempFilePath = `${__dirname}/${obj['UUID']}.json`;
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
            // count++;

        } catch (e) {
            console.log(e);
        } finally {
            fs.unlinkSync(noteTempFilePath);
            setTimeout(done, 1);
            bar.tick(1);
        }
    });
}

if (typeof require != 'undefined' && require.main == module) {
    main(process.argv);
}
