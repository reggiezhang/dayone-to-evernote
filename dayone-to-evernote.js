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
  let ProgressBar = require('progress');
  console.log();
  return new ProgressBar(':percent|:bar|  :current/:total  elapsed: :elapseds  eta: :etas', {
    complete: '█',
    incomplete: ' ',
    width: 40,
    total: totalLength,
  });
}

function getDoNote(doPath, filename) {
  const fs = require('fs');
  const plist = require('plist');
  let doNote = plist.parse(fs.readFileSync(`${getEntriesPath(doPath)}/${filename}`, 'utf8'));
  let photoPath = `${getPhotosPath(doPath)}${doNote['UUID']}.jpg`;
  if (fs.existsSync(photoPath)) doNote['Photo Path'] = photoPath;
  if (doNote['Tags'] == undefined) doNote['Tags'] = [];
  doNote['Tags'][doNote['Tags'].length] = 'dayone';
  return doNote;
}

function preparePrarmsFile(doPath, filename, notebookName) {
  let doNote = getDoNote(doPath, filename);
  let params = {};
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
  let paramsFilePath = `${os.tmpdir()}/${uuidV4()}.json`;
  fs.writeFileSync(paramsFilePath, JSON.stringify(params));
  return paramsFilePath;
}

function getNoteTitle(noteText) {
  return noteText.split('\n')[0];
}

function getEntries(doPath, afterDate) {
  let entriesPath = getEntriesPath(doPath);
  let entriesDir = require('fs').readdirSync(entriesPath);
  if (afterDate === undefined) return entriesDir;
  let entries = entriesDir.filter(function(item) {
    let fs = require('fs');
    let plist = require('plist');
    let obj = plist.parse(fs.readFileSync(`${getEntriesPath(doPath)}/${item}`, 'utf8'));
    let noteDate = new Date(obj['Creation Date']);
    return noteDate > afterDate;
  });
  return entries;
}

function main(argv) {
  const evernote = require('evernote-jxa');
  let program = require('commander');
  require('pkginfo')(module, 'version');
  program
    .version(module.exports.version)
    .option('-a, --after <date>', 'date with ISO8601 format. e.g. 2016-05-10T03:08:07+08:00', Date.parse)
    .arguments('<Journal_dayone_dir>')
    .parse(argv);
  if (!program.args.length
    || program.after !== undefined && isNaN(program.after)) program.help();

  let notebookName = `Dayone: ${new Date().toDateString()}`;
  let doPath = program.args[0];

  let fs = require('fs');
  let entries = getEntries(doPath, program.after);
  let bar = initProgressBar(entries.length);
  evernote.createNotebook(notebookName);
  require('async-foreach').forEach(entries, function(filename) {
    bar.tick(1);
    let done = this.async();
    let paramsFilePath = preparePrarmsFile(doPath, filename, notebookName);
    try {
      evernote.createNote(paramsFilePath);
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
