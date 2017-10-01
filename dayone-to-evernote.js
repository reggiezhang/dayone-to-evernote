#!/usr/bin/env node
/*
 * dayone-to-evernote.js
 * Copyright (C) 2017 Reggie Zhang <reggy.zhang@gmail.com>
 * Licensed under the terms of The GNU Lesser General Public License (LGPLv3):
 * http://www.opensource.org/licenses/lgpl-3.0.html
 *
 */
'use-strict';
function composeEntriesPath(doPath) {
  return `${doPath}/entries/`;
}

function composePhotosPath(doPath) {
  return `${doPath}/photos/`;
}

function composeSyncLogDirPath(doPath) {
  return `${doPath}/.dayone-to-evernote/`;
}

function composeSyncLogPath(doPath, filename) {
  const syncLogDirPath = composeSyncLogDirPath(doPath);
  return `${syncLogDirPath}/.${filename}.json`;
}

function md5ForEntry(doPath, filename) {
  const md5file = require('md5-file');
  return md5file.sync(`${composeEntriesPath(doPath)}/${filename}`);
}

function md5ForPhoto(doPath, uuid) {
  const fs = require('fs');
  const md5file = require('md5-file');
  let photoPath = `${composePhotosPath(doPath)}${uuid}.jpg`;
  return fs.existsSync(photoPath) ? md5file.sync(photoPath) : 'md5';
}

function initProgressBar(totalLength, notebookName, counter) {
  let ProgressBar = require('progress');
  console.log();
  return new ProgressBar(':percent|:bar|  :current/:total  elapsed: :elapseds  eta: :etas', {
    complete: '█',
    incomplete: ' ',
    width: 20,
    total: totalLength,
    renderThrottle: 0,
    clear: false,
    callback: function importCompleted() {  // Method which will display type of Animal
      if (counter.created > 0) {
        console.log(`${counter.created} note(s) created in [${notebookName}], ${counter.updated} note(s) updated.`);
      } else {
        console.log(`${counter.created} note(s) created, ${counter.updated} note(s) updated.`);
      }
    },
  });
}

function loadSyncLog(doPath, filename) {
  let syncLog = null;
  const fs = require('fs');
  const syncLogDirPath = composeSyncLogDirPath(doPath);
  if (!fs.existsSync(syncLogDirPath)) fs.mkdirSync(syncLogDirPath);
  const syncLogFilePath = composeSyncLogPath(doPath, filename);
  if (!fs.existsSync(syncLogFilePath)) return syncLog;
  syncLog = JSON.parse(fs.readFileSync(syncLogFilePath, 'utf8'));
  return syncLog;
}

function loadDoNote(doPath, filename) {
  const fs = require('fs');
  const plist = require('plist');
  let doNote = plist.parse(fs.readFileSync(`${composeEntriesPath(doPath)}/${filename}`, 'utf8'));
  let photoPath = `${composePhotosPath(doPath)}${doNote['UUID']}.jpg`;
  if (fs.existsSync(photoPath)) doNote['Photo Path'] = photoPath;
  if (doNote['Tags'] == undefined) doNote['Tags'] = [];
  doNote['Tags'][doNote['Tags'].length] = 'dayone';
  return doNote;
}

function prepareEvernotePrarmsFile(doPath, filename, notebookName) {
  let doNote = loadDoNote(doPath, filename);
  let params = {};
  params.withText = doNote['Entry Text'];
  params.title = getNoteTitle(params.withText);
  params.notebook = notebookName;
  params.tags = doNote['Tags'];
  params.created = new Date(doNote['Creation Date']);
  if (doNote.Location) {
    params.latitude = doNote.Location.Latitude;
    params.longitude = doNote.Location.Longitude;
  }
  params.attachments = [];
  if (doNote['Photo Path']) {
    params.attachments.push(doNote['Photo Path']);
  }
  params.attachments.push(`${composeEntriesPath(doPath)}/${filename}`);

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

function loadEntries(doPath, afterDate) {
  let entriesPath = composeEntriesPath(doPath);
  let entriesDir = require('fs').readdirSync(entriesPath);
  if (afterDate === undefined) return entriesDir;
  let entries = entriesDir.filter(function compareNoteDate(item) {
    if (/^\./.test(item)) return false;
    let fs = require('fs');
    let plist = require('plist');
    let obj = plist.parse(fs.readFileSync(`${composeEntriesPath(doPath)}/${item}`, 'utf8'));
    let noteDate = new Date(obj['Creation Date']);
    return noteDate > afterDate;
  });
  return entries;
}

function prepareSyncLog(doPath, filename) { // return syncLog if should sync, otherwise return null
  if (/^\./.test(filename)) {
    return null;
  }
  const evernote = require('evernote-jxa');
  let doNote = loadDoNote(doPath, filename);
  let latestEntryMd5 = md5ForEntry(doPath, filename);
  let latestPhotoMd5 = md5ForPhoto(doPath, doNote.UUID);
  let syncLog = loadSyncLog(doPath, filename);
  if (!syncLog) {
    syncLog = {'path': composeSyncLogPath(doPath, filename), 'uuid': doNote.UUID, 'entry-md5': latestEntryMd5, 'photo-md5': latestPhotoMd5, doNote};
    return syncLog;
  } else {
    syncLog.doNote = doNote;
    if (latestEntryMd5 !== syncLog['entry-md5'] || latestPhotoMd5 !== syncLog['photo-md5']
      || syncLog.noteId === undefined || !evernote.findNote(syncLog.noteId.trim())) {
      syncLog['entry-md5'] = latestEntryMd5;
      syncLog['photo-md5'] = latestPhotoMd5;
      if (syncLog.noteId !== undefined) {
        const nbName = evernote.deleteNote(syncLog.noteId.trim());
        if (nbName) syncLog.notebook = nbName;
      }
      return syncLog;
    }
    return null;
  }
}
function saveSyncLog(doPath, syncLog) {
  const fs = require('fs');
  syncLog.date = new Date();
  delete syncLog['doNote'];
  delete syncLog['notebook'];
  const fd = fs.openSync(syncLog.path, 'w');
  fs.writeSync(fd, JSON.stringify(syncLog, null, '    '));
  fs.closeSync(fd);
}
function resetSyncState(reset, doPath) {
  if (!reset) return;
  require('fs-extra').emptyDirSync(composeSyncLogDirPath(doPath));
}
function main(argv) {
  const evernote = require('evernote-jxa');
  let program = require('commander');
  require('pkginfo')(module, 'version');
  program
    .version(module.exports.version)
    .option('-a, --after <date>', 'date with ISO8601 format. e.g. 2016-05-10T03:08:07+08:00', Date.parse)
    .option('-n, --notebook <notebook>', 'Target Notebook Name, a local notebook will be created if not specified.')
    .option('-r, --reset', 'reset sync state, fully sync will be performed.')
    .arguments('<Journal_dayone_dir>')
    .parse(argv);
  if (!program.args.length
    || program.after !== undefined && isNaN(program.after)) program.help();

  let notebookName = program.notebook;
  if (!notebookName) notebookName = `Dayone: ${new Date().toDateString()}`;
  let doPath = program.args[0];

  let fs = require('fs');
  let entries = loadEntries(doPath, program.after);
  const counter = { 'created': 0, 'updated': 0 }; // eslint-disable-line
  let bar = initProgressBar(entries.length, notebookName, counter);
  resetSyncState(program.reset, doPath);

  require('async-foreach').forEach(entries, function createNote(filename) {
    let done = this.async();
    let syncLog = prepareSyncLog(doPath, filename);
    if (syncLog) {
      let paramsFilePath = prepareEvernotePrarmsFile(doPath, filename, syncLog.notebook ? syncLog.notebook : notebookName);
      try {
        syncLog.notebook ? ++counter.updated : ++counter.created;
        if (counter.created > 0) {
          evernote.createNotebook(notebookName);
        }
        syncLog.noteId = evernote.createNote(paramsFilePath);
        saveSyncLog(doPath, syncLog);
      } catch (e) {
        console.log(e);
      } finally {
        fs.unlinkSync(paramsFilePath);
      }
    }
    bar.tick(1);
    setTimeout(done, 1);
  });
}

if (typeof require != 'undefined' && require.main == module) {
  main(process.argv);
}
