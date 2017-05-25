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

function getSyncMetaDirPath(doPath) {
  return `${doPath}/.dayone-to-evernote/`;
}

function getSyncMetaFilePath(doPath, filename) {
  const syncMetaDirPath = getSyncMetaDirPath(doPath);
  return `${syncMetaDirPath}/.${filename}.json`;
}

function getEntryMd5(doPath, filename) {
  const md5file = require('md5-file');
  return md5file.sync(`${getEntriesPath(doPath)}/${filename}`);
}

function getPhotoMd5(doPath, uuid) {
  const fs = require('fs');
  const md5file = require('md5-file');
  let photoPath = `${getPhotosPath(doPath)}${uuid}.jpg`;
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

function loadSyncMeta(doPath, filename) {
  let syncMeta = null;
  const fs = require('fs');
  const syncMetaDirPath = getSyncMetaDirPath(doPath);
  if (!fs.existsSync(syncMetaDirPath)) fs.mkdirSync(syncMetaDirPath);
  const syncMetaFilePath = getSyncMetaFilePath(doPath, filename);
  if (!fs.existsSync(syncMetaFilePath)) return syncMeta;
  syncMeta = JSON.parse(fs.readFileSync(syncMetaFilePath, 'utf8'));
  return syncMeta;
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
  if (doNote.Location) {
    params.latitude = doNote.Location.Latitude;
    params.longitude = doNote.Location.Longitude;
  }
  params.attachments = [];
  if (doNote['Photo Path']) {
    params.attachments.push(doNote['Photo Path']);
  }
  params.attachments.push(`${getEntriesPath(doPath)}/${filename}`);

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
  let entries = entriesDir.filter(function compareNoteDate(item) {
    if (/^\./.test(item)) return false;
    let fs = require('fs');
    let plist = require('plist');
    let obj = plist.parse(fs.readFileSync(`${getEntriesPath(doPath)}/${item}`, 'utf8'));
    let noteDate = new Date(obj['Creation Date']);
    return noteDate > afterDate;
  });
  return entries;
}

function prepareSyncMeta(doPath, filename) { // return syncMeta if should sync, otherwise return null
  if (/^\./.test(filename)) {
    return null;
  }
  const evernote = require('evernote-jxa');
  let doNote = getDoNote(doPath, filename);
  let latestEntryMd5 = getEntryMd5(doPath, filename);
  let latestPhotoMd5 = getPhotoMd5(doPath, doNote.UUID);
  let syncMeta = loadSyncMeta(doPath, filename);
  if (!syncMeta) {
    syncMeta = {'path': getSyncMetaFilePath(doPath, filename), 'uuid': doNote.UUID, 'entry-md5': latestEntryMd5, 'photo-md5': latestPhotoMd5, doNote};
    return syncMeta;
  } else {
    syncMeta.doNote = doNote;
    if (latestEntryMd5 !== syncMeta['entry-md5'] || latestPhotoMd5 !== syncMeta['photo-md5']
      || !evernote.findNote(syncMeta.noteId.trim())) {
      syncMeta['entry-md5'] = latestEntryMd5;
      syncMeta['photo-md5'] = latestPhotoMd5;
      const nbName = evernote.deleteNote(syncMeta.noteId.trim());
      if (nbName) syncMeta.notebook = nbName;
      return syncMeta;
    }
    return null;
  }
}
function saveSyncMeta(doPath, syncMeta) {
  const fs = require('fs');
  syncMeta.date = new Date();
  delete syncMeta['doNote'];
  delete syncMeta['notebook'];
  const fd = fs.openSync(syncMeta.path, 'w');
  fs.writeSync(fd, JSON.stringify(syncMeta, null, '    '));
  fs.closeSync(fd);
}
function resetSyncState(reset, doPath) {
  if (!reset) return;
  require('fs-extra').emptyDirSync(getSyncMetaDirPath(doPath));
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
  let entries = getEntries(doPath, program.after);
  const counter = { 'created': 0, 'updated': 0 }; // eslint-disable-line
  let bar = initProgressBar(entries.length, notebookName, counter);
  resetSyncState(program.reset, doPath);

  require('async-foreach').forEach(entries, function createNote(filename) {
    let done = this.async();
    let syncMeta = prepareSyncMeta(doPath, filename);
    if (syncMeta) {
      let paramsFilePath = preparePrarmsFile(doPath, filename, syncMeta.notebook ? syncMeta.notebook : notebookName);
      try {
        syncMeta.notebook ? ++counter.updated : ++counter.created;
        if (counter.created > 0) {
          evernote.createNotebook(notebookName);
        }
        syncMeta.noteId = evernote.createNote(paramsFilePath);
        saveSyncMeta(doPath, syncMeta);
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
