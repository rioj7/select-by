const vscode = require('vscode');

const getConfigRegExes = (config) => vscode.workspace.getConfiguration(config, null).get('regexes');
const getConfigSelectByRegExes = () => getConfigRegExes('selectby');
const getConfigMoveByRegExes = () => getConfigRegExes('moveby');
const getProperty = (obj, prop, deflt) => { return obj.hasOwnProperty(prop) ? obj[prop] : deflt; };
const getPropertyOrGlobal = (obj, prop, globalProps, deflt) => { return getProperty(obj, prop, getProperty(globalProps, prop, deflt)); };
const isString = obj => typeof obj === 'string';
const isArray = obj => Array.isArray(obj);
const isObject = obj => (typeof obj === 'object') && !isArray(obj);
const isPosInteger = value => /^\d+$/.test(value);

class ConfigRegex {
  constructor(config) {
    this.recentlyUsed = [];
    this.config = config;
  }
  isValidRegex(regex) { return false; }
  defaultOnEmptyList() { return undefined; }
  async getRegexKey(args) {
    if (args !== undefined) { return args; }
    let regexes = getConfigRegExes(this.config);
    let qpItems = [];
    for (const key in regexes) {
      if (!regexes.hasOwnProperty(key)) { continue; }
      const regex = regexes[key];
      if (!this.isValidRegex(regex)) { continue; }
      let label = getProperty(regex, 'label', key);
      if (getProperty(regex, 'copyToClipboard')) { label += ' $(clippy)'; }
      if (getProperty(regex, 'debugNotify')) { label += ' $(debug)'; }
      let description = getProperty(regex, 'description');
      let detail = getProperty(regex, 'detail');
      qpItems.push( { idx: qpItems.length, regexKey: key, label, description, detail } );
    }
    if (qpItems.length === 0) {
      let deflt = this.defaultOnEmptyList();
      if (deflt === undefined) {
        vscode.window.showInformationMessage("No usable regex found");
      }
      return deflt;
    }
    const sortIndex = a => {
      let idx = this.recentlyUsed.findIndex( e => e === a.regexKey );
      return idx >= 0 ? idx : this.recentlyUsed.length + a.idx;
    };
    // we could update recentlyUsed and remove regexKeys that are not found in the setting
    // TODO when we persistently save recentlyUsed
    qpItems.sort( (a, b) => sortIndex(a) - sortIndex(b) );
    return vscode.window.showQuickPick(qpItems)
      .then( item => {
        if (!item) { return undefined; }
        let regexKey = item.regexKey;
        this.recentlyUsed = [regexKey].concat(this.recentlyUsed.filter( e => e !== regexKey ));
        return regexKey;
      });
  }
}

class ConfigRegexSelectBy extends ConfigRegex {
  constructor() {
    super('selectby');
  }
  isValidRegex(regex) {
    return getProperty(regex, 'backward') || getProperty(regex, 'forward') || getProperty(regex, 'forwardNext') || getProperty(regex, 'surround');
  }
}

class ConfigRegexMoveBy extends ConfigRegex {
  constructor() {
    super('moveby');
  }
  isValidRegex(regex) {
    // if (isObject(regex)) {
    //   return getProperty(regex, 'regex') || getProperty(regex, 'ask');
    // }
    return true;
  }
  defaultOnEmptyList() { return {}; }
}

function activate(context) {
  var getConfigRegEx = (regexKey, regexes) => {
    if (!regexes.hasOwnProperty(regexKey)) {
      vscode.window.showErrorMessage(regexKey+" not found.");
      return undefined;
    }
    let config = regexes[regexKey];
    if (getProperty(config, "debugNotify", false)) {
      vscode.window.showInformationMessage(JSON.stringify(config));
    }
    return config;
  };
  var getConfigSelectByRegEx = regexKey => {
    return getConfigRegEx(regexKey, getConfigSelectByRegExes());
  };
  var getConfigMoveByRegEx = regexKey => {
    return getConfigRegEx(regexKey, getConfigMoveByRegExes());
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
  var configRegexSelectBy = new ConfigRegexSelectBy();
  var configRegexMoveBy = new ConfigRegexMoveBy();
  var processRegExKey = (regexKey, editor) => {
    if (!isString(regexKey)) { regexKey = 'regex' + regexKey.toString(10); }
    let search = getConfigSelectByRegEx(regexKey);
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
      let backwardShrink = getProperty(search, "backwardShrink", false);
      let backwardAllowCurrent = getProperty(search, "backwardAllowCurrentPosition", true);
      regex = new RegExp(regex, flags);
      if (backwardShrink) {
        regex.lastIndex = selectStart;
        selectStart = docText.length;
        let result;
        while ((result=regex.exec(docText)) != null) {
          selectStart = incMatch ? result.index : regex.lastIndex;
          if (incMatch && selectStart === offsetCursor) { continue; }
          break;
        }
      } else {
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
    }
    let currentSelectionEnd = editor.document.offsetAt(editor.selection.end);
    let selectEnd = currentSelectionEnd;
    regex = getProperty(search, "forward");
    let regexForwardNext = getProperty(search, "forwardNext");
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
    let startForwardNext = selectEnd;
    let forwardResult = [];
    let needNewForwardSearch = true;
    if (regex && isString(regex)) {
      let forwardInclude = getProperty(search, "forwardInclude", true);
      let forwardShrink = getProperty(search, "forwardShrink", false);
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
        if (forwardShrink) {
          selectEnd = 0;
          regex.lastIndex = 0;
          let result;
          while ((result=regex.exec(docText)) != null) {
            let newSelectEnd = incMatch ? regex.lastIndex : result.index;
            if (newSelectEnd >= currentSelectionEnd) { break; }
            selectEnd = newSelectEnd;
            startForwardNext = regex.lastIndex;
            forwardResult = result.slice();
          }
        } else {
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
    if (selectStart > selectEnd) {
      [selectStart, selectEnd] = [selectEnd, selectStart];
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
    let regexKey = await configRegexSelectBy.getRegexKey(args);
    if (regexKey === undefined) { return; }
    if (isArray(regexKey) && regexKey.length > 0) {
      regexKey = regexKey[0];
    }
    if (isString(regexKey)) {
      processRegExKey(regexKey, editor);
    }
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
  var recentlyUsedMoveByAskRegex = [];
  var moveBy_regex_Ask = async () => {
    return vscode.window.showInputBox({"ignoreFocusOut":true, "prompt": "RegEx to move to"})
    // return vscode.window.showQuickPick(recentlyUsedMoveBy)
    .then( item => {
      if (isString(item) && item.length === 0) { item = undefined; } // accepted an empty inputbox
      if (item) {
        recentlyUsedMoveByAskRegex = [item].concat(recentlyUsedMoveByAskRegex.filter( e => e !== item ));
      }
      return item;
    });
  };
  var positiveInteger_Ask = async (prompt) => {
    return vscode.window.showInputBox({ignoreFocusOut:true, prompt,
          value: "1", validateInput: value => isPosInteger(value) ? undefined : 'Only positive integers' })
    .then( item => {
      if (isString(item) && item.length === 0) { item = undefined; } // accepted an empty inputbox
      return item;
    });
  };
  /** @returns {vscode.Position} @param {vscode.TextEditor} editor @param {vscode.Position} currentPosition @param {RegExp} regex @param {boolean} findPrev @param {boolean} findStart @param {boolean} wrapCursor @param {boolean} checkCurrent */
  var findRegexPosition = (editor, currentPosition, regex, findPrev, findStart, wrapCursor=false, checkCurrent=false) => {
    var docText = editor.document.getText();
    var wrappedCursor = false;
    var offsetCursor = editor.document.offsetAt(currentPosition);
    var location = offsetCursor;
    if (regex) {
      if (checkCurrent) {
        regex.lastIndex = 0;
        let result;
        while ((result = regex.exec(docText))!==null) {
          location = findStart ? result.index : regex.lastIndex;
          if (location > offsetCursor) { break; }
          if (location === offsetCursor) { return editor.document.positionAt(location); }
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
    return editor.document.positionAt(location);
  };
  /** @param {vscode.TextEditor} editor @param {vscode.Position} position */
  var newPositionByProperties = (editor, position, props, propsGlobal) => {
    if (props === undefined) { return position; }
    let regex = getPropertyOrGlobal(props, 'regex', propsGlobal);
    if (regex === undefined) { return position; }
    let direction = getPropertyOrGlobal(props, 'direction', propsGlobal, 'next');
    let repeat = getPropertyOrGlobal(props, 'repeat', propsGlobal, 1);
    let flags = getPropertyOrGlobal(props, 'flags', propsGlobal, '') + 'g';
    regex = new RegExp(regex, flags);
    let findPrev = direction === 'prev';
    let findStart = findPrev;
    range(repeat).forEach(i => {
      let newPosition = findRegexPosition(editor, position, regex, findPrev, findStart);
      if (newPosition !== undefined) { position = newPosition; }
    });
    return position;
  };
  /** @param {vscode.TextEditor} editor @param {vscode.Selection} selection */
  var anchorAndActiveByRegex = (editor, selection, args) => {
    if (args === undefined) { args = {}; }
    let anchor = newPositionByProperties(editor, selection.anchor, getProperty(args, 'anchor'), args);
    let active = newPositionByProperties(editor, selection.active, getProperty(args, 'active'), args);
    return new vscode.Selection(anchor, active);
  };
  /** @param {vscode.TextEditor} editor */
  var selectbySelections = (editor, newSelection) => {
    let selections = editor.selections
        .map(newSelection)
        .filter( s => s !== undefined);
    updateEditorSelections(editor, selections);
  };
  var updateEditorSelections = (editor, selections) => {
    if (selections.length === 0) return;
    editor.selections = selections;
    var rng = new vscode.Range(editor.selection.start, editor.selection.start);
    editor.revealRange(rng, vscode.TextEditorRevealType[vscode.workspace.getConfiguration('moveby', null).get('revealType')]);
  };
  /** @param {readonly vscode.Selection[]} selections */
  var sortSelections = selections => {
    let newSelections = [...selections];
    return newSelections.sort((a, b) => { return a.start.compareTo(b.start); })
  };
  var movebyPositions = (editor, newPosition, repeat) => {
    if (!repeat) { repeat = 1; }
    let selections = editor.selections;
    range(repeat).forEach(i => {
      selections = selections
          .map(newPosition)
          .filter( pos => pos !== undefined)
          .map( position => new vscode.Selection(position, position) );
    });
    updateEditorSelections(editor, selections);
  };
  var movebyRegEx = async (editor, args) => {
    if (args === undefined) {
      args = await configRegexMoveBy.getRegexKey();
    }
    if (isString(args)) {
      args = getConfigMoveByRegEx(args);
    }
    if (args === undefined) { return; }
    let regex, flagsObj, properties;
    let checkCurrent = false;
    let repeat = '1';
    if (Array.isArray(args)) {
      let regexKey = args[0];
      let regexFBM = args[1];
      let search = getConfigSelectByRegEx(regexKey);
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
        repeat = (repeatProp === 'ask') ? await positiveInteger_Ask('Repeat count for move to') : repeatProp;
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
    movebyPositions(editor, s => findRegexPosition(editor, findPrev ? s.start : s.end, regex, findPrev, findStart, wrapCursor, checkCurrent), Number(repeat));
  };
  function calculatePosition(editor, selection, lineNrExFunc, charNrExFunc, offset) {
    let arg = {selection: selection, currentLine: editor.document.lineAt(selection.start.line).text, selections: editor.selections, offset: offset};
    return new vscode.Position(Math.floor(lineNrExFunc(arg)), Math.floor(charNrExFunc(arg)));
  }
  const transformCalculationEx = str => str.replace(/selections?|currentLine|offset/g, 'arg.$&');
  var movebyCalculation = async (editor, args) => {
    if (args === undefined) { args = {}; }
    let lineNrEx = getProperty(args, 'lineNrEx', 'selection.start.line');
    let charNrEx = getProperty(args, 'charNrEx');
    if (!charNrEx) { return; }
    let offset = {line:0, character:0};
    if (lineNrEx.indexOf('offset') !== -1) {
      let offsetInput = await positiveInteger_Ask('Go to offset');
      if (offsetInput === undefined) { return; }
      offset = editor.document.positionAt(Number(offsetInput));
    }
    let lineNrExFunc = expressionFunc(transformCalculationEx(lineNrEx), 'arg');
    let charNrExFunc = expressionFunc(transformCalculationEx(charNrEx), 'arg');
    movebyPositions(editor, s => calculatePosition(editor, s, lineNrExFunc, charNrExFunc, offset));
  };
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.swapActive', editor => {
    editor.selections = editor.selections.map( s => new vscode.Selection(s.active, s.anchor));
  }) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.anchorAndActiveSeparate', editor => {
    editor.selections = sortSelections(editor.selections).map( s => {
      if (s.isEmpty) { return s; }
      return [new vscode.Selection(s.start, s.start), new vscode.Selection(s.end, s.end)];
    }).flat();
  }) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.anchorAndActiveByRegex', (editor, edit, args) => {
    if (args === undefined) { return; }
    selectbySelections(editor, s => anchorAndActiveByRegex(editor, s, args));
  }) );
  let markFirst;
  let markPositions = [];
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
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.mark-restore', (editor, edit, args) => {
    if (!editor) { return; }
    if (markPositions.length == 0) { return; }
    if (args === undefined) { args = {}; }
    editor.selections = markPositions.map( m => new vscode.Selection(m, m) );
    if (!getProperty(args, 'keepMarks')) {
      editor.setDecorations(markDecoration, []);
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
  const positionAtOffset = (editor, position, args) => {
    let newOffset = editor.document.offsetAt(position) + getProperty(args, 'offset', 1);
    if (newOffset<0 || newOffset>editor.document.getText().length) { return undefined; }
    return editor.document.positionAt(newOffset);
  };
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.addNewSelection', (editor, edit, args) => {
    if (args === undefined) { args = {}; }
    let selections = editor.selections.slice();
    const newPosition = positionAtOffset(editor, selections[selections.length-1].end, args);
    if (!newPosition) { return; }
    selections.push(new vscode.Selection(newPosition, newPosition));
    updateEditorSelections(editor, selections);
  }) );
  // TODO name change 2022-04-02
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.addNewSelectionAtOffset', (editor, edit, args) => {
    vscode.window.showInformationMessage('selectby.addNewSelectionAtOffset renamed to selectby.addNewSelection');
  }) );
  const updateSelection = (editor, selection, argsAnchor, argsActive) => {
    let newAnchor = positionAtOffset(editor, selection.anchor, argsAnchor);
    let newActive = positionAtOffset(editor, selection.active, argsActive);
    if (!newAnchor || !newActive) { return; }
    return new vscode.Selection(newAnchor, newActive);
  };
  const updateLastSelection = (editor, argsAnchor, argsActive) => {
    let selections = editor.selections.slice();
    let lastSelectionIdx = selections.length-1;
    let lastSelection = selections[lastSelectionIdx];
    let newAnchor = positionAtOffset(editor, lastSelection.anchor, argsAnchor);
    let newActive = positionAtOffset(editor, lastSelection.active, argsActive);
    if (!newAnchor || !newActive) { return; }
    selections[lastSelectionIdx] = new vscode.Selection(newAnchor, newActive);
    updateEditorSelections(editor, selections);
  };
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.moveLastSelection', (editor, edit, args) => {
    if (args === undefined) { args = {}; }
    updateLastSelection(editor, args, args);
  }) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.moveLastSelectionActive', (editor, edit, args) => {
    if (args === undefined) { args = {}; }
    updateLastSelection(editor, {offset:0}, args);
  }) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.moveSelections', (editor, edit, args) => {
    if (args === undefined) { args = {}; }
    let offset0 = {offset:0};
    let offset = getProperty(args, 'offset');
    offset = (offset === undefined) ? offset0 : {offset};
    let start = getProperty(args, 'start');
    let end = getProperty(args, 'end');
    let anchor = getProperty(args, 'anchor');
    let active = getProperty(args, 'active');
    if (start || end) {
      if (start === undefined) { start = offset0; }
      if (end === undefined) { end = offset0; }
    } else if (anchor || active) {
      if (anchor === undefined) { anchor = offset0; }
      if (active === undefined) { active = offset0; }
    } else {
      anchor = offset;
      active = offset;
    }
    let selections = editor.selections.map(s => {
      if (start) {
        return updateSelection(editor, s, s.isReversed ? end : start, s.isReversed ? start : end);
      }
      return updateSelection(editor, s, anchor, active);
    });
    updateEditorSelections(editor, selections);
  }) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('moveby.regex', (editor, edit, args) => { movebyRegEx(editor, args);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('moveby.calculation', (editor, edit, args) => { movebyCalculation(editor, args);}) );
};

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
