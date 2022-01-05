const vscode = require('vscode');

function activate(context) {

  var getProperty = (obj, prop, deflt) => { return obj.hasOwnProperty(prop) ? obj[prop] : deflt; };
  var isString = obj => typeof obj === 'string';
  const isArray = obj => Array.isArray(obj);
  const isObject = obj => (typeof obj === 'object') && !isArray(obj);

  var isPosInteger = value => /^\d+$/.test(value);
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
  function range(size, startAt = 0) { return [...Array(size).keys()].map(i => i + startAt); }  // https://stackoverflow.com/a/10050831/9938317
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
  var processRegExKey = (regexKey, editor) => {
    if (!isString(regexKey)) { regexKey = 'regex' + regexKey.toString(10); }
    let search = getConfigRegEx(regexKey);
    processRegExSearch(search, editor);
  };
  var processRegExSearch = (search, editor) => {
    if (!search) { return; }
    var docText = editor.document.getText();
    // position of cursor is "start" of selection
    var offsetCursor = editor.document.offsetAt(editor.selection.start);
    var selectStart = offsetCursor;
    var flags = getProperty(search, "flags", "") + "g";
    var regex;
    regex = getProperty(search, "backward");
    if (regex && isString(regex)) {
      let incMatch = getProperty(search, "backwardInclude", true);
      let backwardAllowCurrent = getProperty(search, "backwardAllowCurrentPosition", true);
      regex = new RegExp(regex, flags);
      selectStart = 0;
      regex.lastIndex = 0;
      while (true) {
        let prevLastIndex = regex.lastIndex;
        let result = regex.exec(docText);
        if (result == null) { break; }
        if (result.index >= offsetCursor) { break; }
        let newSelectStart = incMatch ? result.index : regex.lastIndex;
        if (prevLastIndex === regex.lastIndex) { // empty match
          regex.lastIndex = prevLastIndex + 1;
        }
        if (!backwardAllowCurrent && newSelectStart === offsetCursor) { continue; }
        selectStart = newSelectStart;
      }
    }
    let currentSelectionEnd = editor.document.offsetAt(editor.selection.end);
    let selectEnd = currentSelectionEnd;
    regex = getProperty(search, "forward");
    var regexForwardNext = getProperty(search, "forwardNext");
    let forwardNextInclude = getProperty(search, "forwardNextInclude", true);
    let forwardNextExtendSelection = getProperty(search, "forwardNextExtendSelection", false);
    let forwardAllowCurrent = getProperty(search, "forwardAllowCurrentPosition", true);
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
          if (!forwardAllowCurrent && selectEnd === currentSelectionEnd) { continue; }
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
    if (isObject(args)) {
      processRegExSearch(args, editor);
      return;
    }
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
    processRegExKey(regexKey, editor);
  };
  let lastLineNrExInput = 'c+6k';
  var selectBy_lineNrEx_Ask = async (args) => {
    if (args === undefined) { args = {}; }
    let lineNrEx = getProperty(args, 'lineNrEx');
    if (lineNrEx) { return lineNrEx; }
    return vscode.window.showInputBox({"ignoreFocusOut":true, "prompt": "lineNr Expression to place cursors; c+6k ; inselection", "value": lastLineNrExInput})
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
  var moveBy_repeat_Ask = async () => {
    return vscode.window.showInputBox({ignoreFocusOut:true, prompt: "Repeat count for move to",
          value: "1", validateInput: value => isPosInteger(value) ? undefined : 'Only positive integers' })
    .then( item => {
      if (isString(item) && item.length === 0) { item = undefined; } // accepted an empty inputbox
      return item;
    });
  };
  var findRegexLocation = (editor, selectionN, regex, findPrev, findStart, wrapCursor, checkCurrent) => {
    var docText = editor.document.getText();
    var wrappedCursor = false;
    var offsetCursor = editor.document.offsetAt(findPrev ? selectionN.start : selectionN.end);
    var location = offsetCursor;
    if (regex) {
      if (checkCurrent) {
        regex.lastIndex = 0;
        let result;
        while ((result = regex.exec(docText))!==null) {
          location = findStart ? result.index : regex.lastIndex;
          if (location > offsetCursor) { break; }
          if (location === offsetCursor) { return location; }
        }
      }
      regex.lastIndex = findPrev ? 0 : offsetCursor;
      while (true) {
        let prevLastIndex = regex.lastIndex;
        let result = regex.exec(docText);
        if (result === null) {
          if (wrapCursor) {
            wrapCursor = undefined; // only wrap once
            if (findPrev) {
              if (location !== offsetCursor) { break; } // found one before offsetCursor
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
          if (location !== offsetCursor) { break; } // found one before offsetCursor
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
  var movebyLocations = (editor, newLocation, repeat) => {
    if (!repeat) { repeat = 1; }
    let locations = editor.selections;
    range(repeat).forEach(i => {
      locations = locations
          .map(newLocation)
          .filter( loc => loc !== undefined)
          .map( location => {
            location = editor.document.positionAt(location);
            return new vscode.Selection(location, location);
          });
    });
    updateEditorSelections(editor, locations);
  };
  var movebyRegEx = async (editor, args) => {
    if (args === undefined) { args = {}; } // TODO use QuickSelect to construct an args array
    let regex, flagsObj, properties;
    let checkCurrent = false;
    let repeat = '1';
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
      checkCurrent = getProperty(args, 'checkCurrent', false);
      let repeatProp = getProperty(args, 'repeat');
      if (repeatProp !== undefined) {
        repeat = (repeatProp === 'ask') ? await moveBy_repeat_Ask() : repeatProp;
        repeat = String(repeat);
      }
    }
    if (!(regex && isString(regex))) { return; } // not found or Escaped Quickpick
    if (!(isPosInteger(repeat) && (Number(repeat)>0) )) { return; } // not found or Escaped InputBox
    let flags = getProperty(flagsObj, 'flags', '') + 'g';
    regex = new RegExp(regex, flags);
    let findPrev = properties.indexOf('prev') >= 0;
    let findStart = properties.indexOf('start') >= 0;
    let wrapCursor = properties.indexOf('wrap') >= 0;
    movebyLocations(editor, s => findRegexLocation(editor, s, regex, findPrev, findStart, wrapCursor, checkCurrent), Number(repeat));
  };
  function calculateLocation(editor, selection, lineNrExFunc, charNrExFunc) {
    let arg = {selection: selection, currentLine: editor.document.lineAt(selection.start.line).text, selections: editor.selections};
    return editor.document.offsetAt(new vscode.Position(Math.floor(lineNrExFunc(arg)), Math.floor(charNrExFunc(arg))));
  }
  const transformCalculationEx = str => str.replace(/selections?|currentLine/g, 'arg.$&');
  var movebyCalculation = async (editor, args) => {
    if (args === undefined) { args = {}; }
    let lineNrEx = getProperty(args, 'lineNrEx', 'selection.start.line');
    let charNrEx = getProperty(args, 'charNrEx');
    if (!charNrEx) { return; }
    let lineNrExFunc = expressionFunc(transformCalculationEx(lineNrEx), 'arg');
    let charNrExFunc = expressionFunc(transformCalculationEx(charNrEx), 'arg');
    movebyLocations(editor, s => calculateLocation(editor, s, lineNrExFunc, charNrExFunc));
  };
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.swapActive', editor => {
    editor.selections = editor.selections.map( s => new vscode.Selection(s.active, s.anchor));
  }) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.anchorAndActiveSeparate', editor => {
    editor.selections = editor.selections.map( s => {
      if (s.isEmpty) { return s; }
      return [new vscode.Selection(s.active, s.active), new vscode.Selection(s.anchor, s.anchor)];
    }).flat();
  }) );
  let markFirst;
  let markPositions;
  function resetMarks() {
    markFirst = true;
    markPositions = [];
  }
  resetMarks();
  let markDecoration;
  (function createMarkDecoration() {
    let options = { before: { contentText: '◆', color: new vscode.ThemeColor('editor.selectionBackground') } };
    markDecoration = vscode.window.createTextEditorDecorationType(options);
  })();
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.mark', (editor, edit, args) => {
    if (!editor) { return; }
    if (args === undefined) { args = {}; }
    if (getProperty(args, 'first')) { resetMarks(); }
    if (markFirst) {
      markPositions = editor.selections.map( s => s.start );
      markFirst = false;
      editor.setDecorations(markDecoration, markPositions.map( m => new vscode.Range(m, m) ) );
    } else {
      editor.setDecorations(markDecoration, []);
      if (editor.selections.length !== markPositions.length ) {
        vscode.window.showWarningMessage(`Different number of cursors: ${editor.selections.length} != ${markPositions.length}`);
      } else {
        editor.selections = editor.selections.map( (s, i) => new vscode.Selection(markPositions[i], s.active) );
      }
      resetMarks();
    }
  }) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex1', (editor, edit, args) => { processRegExKey(1, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex2', (editor, edit, args) => { processRegExKey(2, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex3', (editor, edit, args) => { processRegExKey(3, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex4', (editor, edit, args) => { processRegExKey(4, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex5', (editor, edit, args) => { processRegExKey(5, editor);}) );
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
  function transform_inselection(startLineNr, endLineNr) {
    return match => `((n>=${startLineNr}) && (n<=${endLineNr}))`;
  }
  class LineNrTest {
    /** @param {number} startLineNr @param {string} lineNrEx */
    constructor(startLineNr, lineNrEx) {
      this.startLineNr = startLineNr;
      this.func = expressionFunc(lineNrEx, 'c,n');
    }
    test(n) { return this.func(this.startLineNr+1, n+1); } // zero based line numbers
  }
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.lineNr', async (editor, edit, args) => {
    let lineNrEx = await selectBy_lineNrEx_Ask(args);
    if (!isString(lineNrEx) || lineNrEx.length == 0) { return; }
    try {
      lineNrEx = lineNrEx.replace(/c\s*\+\s*(\d+)\s*k/g, transform_line_modulo);
      /** @type {LineNrTest[]} */
      let lineNrTests = [];
      if (lineNrEx.indexOf('inselection') >= 0) {
        for (const selection of editor.selections) {
          let selectionStartLineNr = selection.start.line;
          let selectionEndLineNr = selection.end.line;
          if (selection.end.character === 0) {
            selectionEndLineNr--; // cursor at start of line does not select any on that line
          }
          lineNrTests.push( new LineNrTest(selectionStartLineNr, lineNrEx.replace(/inselection/g, transform_inselection(selectionStartLineNr+1, selectionEndLineNr+1))) );
        }
      } else {
        lineNrTests.push( new LineNrTest(editor.selection.start.line, lineNrEx) );
      }
      let lineCount = editor.document.lineCount;
      let locations = [];
      for (let n = 0; n < lineCount; ++n) {
        if (lineNrTests.some( lineNrTest => lineNrTest.test(n) )) {
          let position = new vscode.Position(n, 0);
          if (locations.push(new vscode.Selection(position, position)) >= 10000) { break; }
        }
      }
      updateEditorSelections(editor, locations);
    } catch (ex) {
      vscode.window.showInformationMessage(ex.message);
    }
  }) );
  let removeCursor = (editor, args, filterFunc) => {
    if (editor.selections.length == 1) { return; }
    let locations = editor.selections.sort((a, b) => { return a.start.compareTo(b.start); }).filter(filterFunc);
    updateEditorSelections(editor, locations);
  };
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.removeCursorBelow', (editor, edit, args) => {
    removeCursor(editor, args, (sel, index, arr) => index < arr.length-1 );
  }) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.removeCursorAbove', (editor, edit, args) => {
    removeCursor(editor, args, (sel, index, arr) => index > 0 );
  }) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('moveby.regex', (editor, edit, args) => { movebyRegEx(editor, args);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('moveby.calculation', (editor, edit, args) => { movebyCalculation(editor, args);}) );
};

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
