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
  function expressionFunc(expr, args) {
    try {
      return Function(`"use strict";return (function calcexpr(${args}) {
        let val = ${expr};
        if (isNaN(val)) { throw new Error("Error calculating: ${expr}"); }
        return val;
      })`)();
    }
    catch (ex) {
      let message = ex.message;
      if (message.indexOf("';'") >= 0) { message = "Incomplete expression"; }
      throw new Error(`${message} in ${expr}`);
    }
  }
  var recentlyUsedSelectBy = [];
  var recentlyUsedMoveBy = [];
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
      editor.revealRange(editor.selection);  // found by johnnytemp in #10
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
  let lastLineNrExInput = 'c+6k';
  var selectBy_lineNrEx_Ask = async (args) => {
    if (args === undefined) { args = {}; }
    let lineNrEx = getProperty(args, 'lineNrEx');
    if (lineNrEx) { return lineNrEx; }
    return vscode.window.showInputBox({"ignoreFocusOut":true, "prompt": "lineNrEx to place cursors", "value": lastLineNrExInput})
    .then( item => {
      if (isString(item) && item.length === 0) { item = undefined; } // accepted an empty inputbox
      if (item) {lastLineNrExInput = item; }
      return item;
    });
  };
  var moveBy_regex_Ask = async () => {
    return vscode.window.showInputBox({"ignoreFocusOut":true, "prompt": "RegEx to move to"})
    // return vscode.window.showQuickPick(recentlyUsedMoveBy)
    .then( item => {
      if (isString(item) && item.length === 0) { item = undefined; } // accepted an empty inputbox
      if (item) {
        recentlyUsedMoveBy = [item].concat(recentlyUsedMoveBy.filter( e => e !== item ));
      }
      return item;
    });
  };
  var findRegexLocation = (editor, selectionN, regex, findPrev, findStart, wrapCursor) => {
    var docText = editor.document.getText();
    var wrappedCursor = false;
    var offsetCursor = editor.document.offsetAt(findPrev ? selectionN.start : selectionN.end);
    var location = offsetCursor;
    if (regex) {
      regex.lastIndex = findPrev ? 0 : offsetCursor;
      while (true) {
        let prevLastIndex = regex.lastIndex;
        let result = regex.exec(docText);
        if (result === null) {
          if (wrapCursor) {
            wrapCursor = undefined; // only wrap once
            if (findPrev) {
              return undefined; // leave cursor at current location, not found anywhere in the file
            } else {
              regex.lastIndex = 0;
              result = regex.exec(docText);
              if (result == null) { return undefined; } // leave cursor at current location, not found anywhere in the file
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
          return undefined; // not found, skip cursor or leave at current location
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
          return undefined; // not found, skip cursor or leave at current location
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
  var updateEditorSelections = (editor, locations) => {
    if (locations.length === 0) return;
    editor.selections = locations;
    var rng = new vscode.Range(editor.selection.start, editor.selection.start);
    editor.revealRange(rng, vscode.TextEditorRevealType[vscode.workspace.getConfiguration('moveby', null).get('revealType')]);
  };
  var movebyLocations = (editor, newLocation) => {
    var locations = editor.selections
          .map(newLocation)
          .filter( loc => loc !== undefined)
          .map( location => {
            location = editor.document.positionAt(location);
            return new vscode.Selection(location, location);
          });
    updateEditorSelections(editor, locations);
  };
  var movebyRegEx = async (editor, args) => {
    if (args === undefined) { args = {}; } // TODO use QuickSelect to construct an args array
    let regex, flagsObj, properties;
    if (Array.isArray(args)) {
      let regexKey = args[0];
      let regexFBM = args[1];
      let search = getConfigRegEx(regexKey);
      if (search === undefined) { return; }
      regex = getProperty(search, regexFBM);
      flagsObj = search;
      properties = args.slice(2);
    } else {
      regex = getProperty(args, 'regex');
      if (!regex) {
        regex = await moveBy_regex_Ask();
      }
      flagsObj = args;
      properties = getProperty(args, 'properties', []);
    }
    if (!(regex && isString(regex))) { return; } // not found or Escaped Quickpick
    let flags = getProperty(flagsObj, 'flags', '') + 'g';
    regex = new RegExp(regex, flags);
    let findPrev = properties.indexOf('prev') >= 0;
    let findStart = properties.indexOf('start') >= 0;
    let wrapCursor = properties.indexOf('wrap') >= 0;
    movebyLocations(editor, s => findRegexLocation(editor, s, regex, findPrev, findStart, wrapCursor));
  };
  function calculateLocation(editor, selection, lineNrExFunc, charNrExFunc) {
    let arg = {selection: selection, currentLine: editor.document.lineAt(selection.start.line).text};
    return editor.document.offsetAt(new vscode.Position(Math.floor(lineNrExFunc(arg)), Math.floor(charNrExFunc(arg))));
  }
  const transformCalculationEx = str => str.replace(/selection|currentLine/g, 'arg.$&');
  var movebyCalculation = async (editor, args) => {
    if (args === undefined) { args = {}; }
    let lineNrEx = getProperty(args, 'lineNrEx', 'selection.start.line');
    let charNrEx = getProperty(args, 'charNrEx');
    if (!charNrEx) { return; }
    let lineNrExFunc = expressionFunc(transformCalculationEx(lineNrEx), 'arg');
    let charNrExFunc = expressionFunc(transformCalculationEx(charNrEx), 'arg');
    movebyLocations(editor, s => calculateLocation(editor, s, lineNrExFunc, charNrExFunc));
  };

  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex1', (editor, edit, args) => { processRegEx(1, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex2', (editor, edit, args) => { processRegEx(2, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex3', (editor, edit, args) => { processRegEx(3, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex4', (editor, edit, args) => { processRegEx(4, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex5', (editor, edit, args) => { processRegEx(5, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex', (editor, edit, args) => { selectbyRegEx(editor, args);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.pasteClipboard', async (editor, edit, args) => {
    if (editor.selections.length > 1) {
      vscode.window.showInformationMessage("Multi Cursor Paste and select not supported yet.");
      return;
    }
    let content = await vscode.env.clipboard.readText();
    if (isString(content)) {
      editor.edit( editBuilder => editBuilder.replace(editor.selection, content) ); // need new editBuilder after await
    }
  }) );
  let transform_line_modulo = (match, number) => `((n-c)%${number}==0 && n>=c)`;
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.lineNr', async (editor, edit, args) => {
    let lineNrEx = await selectBy_lineNrEx_Ask(args);
    if (!isString(lineNrEx) || lineNrEx.length == 0) { return; }
    try {
      let lineNrExFunc = expressionFunc(lineNrEx.replace(/c\s*\+\s*(\d+)\s*k/g, transform_line_modulo), 'c,n');
      let currentLineNr = editor.selection.start.line;
      let lineCount = editor.document.lineCount;
      let locations = [];
      for (let n = 0; n < lineCount; ++n) {
        if (lineNrExFunc(currentLineNr+1, n+1)) { // zero based line numbers
          let position = new vscode.Position(n, 0);
          if (locations.push(new vscode.Selection(position, position)) >= 10000) { break; }
        }
      }
      updateEditorSelections(editor, locations);
    } catch (ex) {
      vscode.window.showInformationMessage(ex.message);
    }
  }) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('moveby.regex', (editor, edit, args) => { movebyRegEx(editor, args);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('moveby.calculation', (editor, edit, args) => { movebyCalculation(editor, args);}) );
};

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
