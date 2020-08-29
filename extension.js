const vscode = require('vscode');

function activate(context) {

  var getProperty = (obj, prop, deflt) => { return obj.hasOwnProperty(prop) ? obj[prop] : deflt; };
  var isString = obj => typeof obj === 'string';
  var getConfigRegExes = () => vscode.workspace.getConfiguration('selectby', null).get('regexes');
  var getConfigRegEx = regexKey => {
    let regexes = getConfigRegExes();
    if (!regexes.hasOwnProperty(regexKey)) {
      vscode.window.showErrorMessage(regexKey+" not found.");
      return undefined;
    }
    let search = regexes[regexKey];
    if (getProperty(search, "debugNotify", false)) {
      vscode.window.showInformationMessage(JSON.stringify(search));
    }
    return search;
  };
  var recentlyUsedSelectBy = [];
  var processRegEx = (regexKey, editor) => {
    if (!isString(regexKey)) { regexKey = 'regex' + regexKey.toString(10); }
    let search = getConfigRegEx(regexKey);
    if (search === undefined) { return; }
    var docText = editor.document.getText();
    // position of cursor is "start" of selection
    var offsetCursor = editor.document.offsetAt(editor.selection.start);
    var selectStart = offsetCursor;
    var flags = getProperty(search, "flags", "") + "g";
    var regex;
    regex = getProperty(search, "backward");
    if (regex && isString(regex)) {
      let incMatch = getProperty(search, "backwardInclude", true);
      regex = new RegExp(regex, flags);
      selectStart = 0;
      regex.lastIndex = 0;
      let result;
      while ((result=regex.exec(docText)) != null) {
        if (result.index >= offsetCursor) break;
        selectStart = incMatch ? result.index : regex.lastIndex;
      }
    }
    var selectEnd = editor.document.offsetAt(editor.selection.end);
    regex = getProperty(search, "forward");
    var regexForwardNext = getProperty(search, "forwardNext");
    let forwardNextInclude = getProperty(search, "forwardNextInclude", true);
    let forwardNextExtendSelection = getProperty(search, "forwardNextExtendSelection", false);
    let searchForwardNext = (forwardResult, startForwardNext) => {
      if (!(regexForwardNext && isString(regexForwardNext))) return [undefined, undefined];
      let regexForwardNextModified = regexForwardNext.replace(/{{(\d+)}}/g, (match, p1) => {
        let groupNr = parseInt(p1, 10);
        if (groupNr >= forwardResult.length) { return ""; }
        return forwardResult[groupNr];
      });
      let regex = new RegExp(regexForwardNextModified, flags);
      regex.lastIndex = startForwardNext;
      let matchStart = docText.length;
      let matchEnd = docText.length;
      let result;
      let incMatch = forwardNextInclude;
      while ((result=regex.exec(docText)) != null) {
        matchStart = result.index;
        matchEnd = incMatch ? regex.lastIndex : result.index;
        break;
      }
      return [matchStart, matchEnd];
    };
    var startForwardNext = selectEnd;
    var forwardResult = [];
    let needNewForwardSearch = true;
    if (regex && isString(regex)) {
      let forwardInclude = getProperty(search, "forwardInclude", true);
      let incMatch = forwardInclude;
      if (regexForwardNext && isString(regexForwardNext)) { // we have to flip the incMatch
        incMatch = !incMatch;
      }
      regex = new RegExp(regex, flags);
      if (forwardNextExtendSelection) {
        selectStart = offsetCursor; // ignore any backward search
        let result;
        if (forwardInclude) {
          regex.lastIndex = selectStart; // check if forward is found at begin of selection
          if ((result=regex.exec(docText)) != null) {
            if (result.index === selectStart) {
              needNewForwardSearch = false;
              forwardResult = result.slice();
            }
          }
        } else { // check if forward is exact before selection
          let matchEnd = docText.length;
          regex.lastIndex = 0;
          let result;
          while ((result=regex.exec(docText)) != null) {
            matchEnd = regex.lastIndex;
            if (matchEnd >= offsetCursor) break;
          }
          if (matchEnd === offsetCursor) {
            needNewForwardSearch = false;
            forwardResult = result.slice();
          }
        }
        if (!needNewForwardSearch) { // test if forwardNext is at selectEnd
          if (searchForwardNext(forwardResult, selectEnd)[0] !== selectEnd) {
            needNewForwardSearch = true;
          }
        }
      }
      if (needNewForwardSearch) {
        regex.lastIndex = selectEnd;
        selectEnd = docText.length;
        startForwardNext = docText.length;
        let result;
        while ((result=regex.exec(docText)) != null) {
          selectEnd = incMatch ? regex.lastIndex : result.index;
          startForwardNext = regex.lastIndex;
          forwardResult = result.slice();
          break;
        }
      }
    }
    if (regexForwardNext && isString(regexForwardNext)) {
      if (needNewForwardSearch) {
        selectStart = selectEnd;
      }
      selectEnd = searchForwardNext(forwardResult, startForwardNext)[1];
    }
    regex = getProperty(search, "surround");
    if (regex && isString(regex)) {
      regex = new RegExp(regex, flags);
      regex.lastIndex = 0;
      let result;
      while ((result=regex.exec(docText)) != null) {
        if (result.index <= offsetCursor && selectEnd <= regex.lastIndex) {
          selectStart = result.index;
          selectEnd   = regex.lastIndex;
          break;
        }
      }
    }
    if (getProperty(search, "copyToClipboard", false)) {
      vscode.env.clipboard.writeText(docText.substring(selectStart, selectEnd)).then((v)=>v, (v)=>null);
    }
    if (getProperty(search, "showSelection", true)) {
      editor.selection = new vscode.Selection(editor.document.positionAt(selectStart), editor.document.positionAt(selectEnd));
    }
  };

  var selectbyRegEx = async (editor, args) => {
    let regexKey = await new Promise(resolve => {
      if (args !== undefined) {
        resolve(args[0]);
        return;
      }
      let regexes = getConfigRegExes();
      let qpItems = [];
      for (const key in regexes) {
        if (!regexes.hasOwnProperty(key)) { continue; }
        const regex = regexes[key];
        if (!(getProperty(regex, 'backward') || getProperty(regex, 'forward') || getProperty(regex, 'forwardNext') || getProperty(regex, 'surround'))) { continue; }
        let label = getProperty(regex, 'label', key);
        if (getProperty(regex, 'copyToClipboard')) { label += ' $(clippy)'; }
        if (getProperty(regex, 'debugNotify')) { label += ' $(debug)'; }
        let description = getProperty(regex, 'description');
        let detail = getProperty(regex, 'detail');
        qpItems.push( { idx: qpItems.length, regexKey: key, label, description, detail } );
      }
      if (qpItems.length === 0) {
        vscode.window.showInformationMessage("No usable regex found");
        resolve(undefined);
        return;
      }
      const sortIndex = a => {
        let idx = recentlyUsedSelectBy.findIndex( e => e === a.regexKey );
        return idx >= 0 ? idx : recentlyUsedSelectBy.length + a.idx;
      };
      // we could update recentlyUsedSelectBy and remove regexKeys that are not found in the setting
      // TODO when we persistently save recentlyUsedSelectBy
      qpItems.sort( (a, b) => sortIndex(a) - sortIndex(b) );
      resolve(vscode.window.showQuickPick(qpItems)
        .then( item => {
          if (item) {
            let regexKey = item.regexKey;
            recentlyUsedSelectBy = [regexKey].concat(recentlyUsedSelectBy.filter( e => e !== regexKey ));
          }
          return item;
      }));
    }).then( item => {
      if (isString(item)) return item;
      return item ? item.regexKey : undefined;
    });
    if (regexKey === undefined) { return; }
    processRegEx(regexKey, editor);
  };

  var findRegexLocation = (editor, regexKey, regexFBM, nextPrev, startEnd, wrapCursor) => {
    let search = getConfigRegEx(regexKey);
    if (search === undefined) { return undefined; }

    var docText = editor.document.getText();

    var findPrev = (nextPrev === "prev");
    var findStart = (startEnd === "start");
    wrapCursor = (wrapCursor === "wrap");
    var wrappedCursor = false;
    var offsetCursor = editor.document.offsetAt(findPrev ? editor.selection.start : editor.selection.end);
    var location = offsetCursor;
    var flags = getProperty(search, "flags", "") + "g";
    var regex;
    regex = getProperty(search, regexFBM);
    if (regex && isString(regex)) {
      regex = new RegExp(regex, flags);
      regex.lastIndex = findPrev ? 0 : offsetCursor;
      while (true) {
        let prevLastIndex = regex.lastIndex;
        let result=regex.exec(docText);
        if (result === null) {
          if (wrapCursor) {
            wrapCursor = undefined; // only wrap once
            if (findPrev) {
              break; // leave cursor at current location
            } else {
              regex.lastIndex = 0;
              result = regex.exec(docText);
              if (result == null) { break; } // leave cursor at current location
              if (result.index == 0) { // found at start of file
                location = findStart ? result.index : regex.lastIndex;
                break;
              }
              location = 0;
              offsetCursor = location;
              regex.lastIndex = location;
              continue;
            }
          }
          break;
        }
        var resultLocation = findStart ? result.index : regex.lastIndex;
        if (prevLastIndex === regex.lastIndex) { // search for empty line
          regex.lastIndex = prevLastIndex + 1;
        }
        if (findPrev) {
          // for the regex in the file: #hit >= 1
          if (resultLocation >= offsetCursor) {
            if (offsetCursor === docText.length && wrappedCursor && resultLocation === offsetCursor) {
              location = offsetCursor; // a hit at the very end of the file
              break;
            }
            if (location !== offsetCursor) { break; } // found one before offsetCursor
            if (wrapCursor) {
              wrapCursor = undefined; // only wrap once
              wrappedCursor = true;
              offsetCursor = docText.length;
              location = offsetCursor;
              regex.lastIndex = 0;
              continue;
            }
            break;
          }
          location = resultLocation;
        } else { // Next
          if (resultLocation > offsetCursor) {
            location = resultLocation;
            break;
          }
        }
      }
    }
    return location;
  };
  var movebyRegEx = (editor, args) => {
    if (args === undefined) return; // TODO use QuickSelect to construct an args array
    var location = findRegexLocation(editor, args[0], args[1], args[2], args[3], args[4]);
    if (location === undefined) return;
    location = editor.document.positionAt(location);
    editor.selection = new vscode.Selection(location, location);
    var rng = new vscode.Range(location, location);
    editor.revealRange(rng, vscode.TextEditorRevealType[vscode.workspace.getConfiguration('moveby', null).get('revealType')]);
  };

  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex1', (editor, edit, args) => { processRegEx(1, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex2', (editor, edit, args) => { processRegEx(2, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex3', (editor, edit, args) => { processRegEx(3, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex4', (editor, edit, args) => { processRegEx(4, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex5', (editor, edit, args) => { processRegEx(5, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex', (editor, edit, args) => { selectbyRegEx(editor, args);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('moveby.regex', (editor, edit, args) => { movebyRegEx(editor, args);}) );
};

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
