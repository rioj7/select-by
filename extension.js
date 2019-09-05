const vscode = require('vscode');

function activate(context) {

  var getProperty = (obj, prop, deflt) => { return obj.hasOwnProperty(prop) ? obj[prop] : deflt; };
  var processRegEx = (nr, editor) => {
    let regexes = vscode.workspace.getConfiguration('selectby', null).get('regexes');
    let key = 'regex' + nr.toString(10);
    if (!regexes.hasOwnProperty(key)) {
      vscode.window.showErrorMessage('Regex '+nr.toString(10)+" not found.");
      return;
    }
    let search = regexes[key];
    var docText = editor.document.getText();
    // position of cursor is "start" of selection
    var offsetCursor = editor.document.offsetAt(editor.selection.start);
    var selectStart = offsetCursor;
    var flags = getProperty(search, "flags", "") + "g";
    var regex;
    regex = getProperty(search, "backward");
    if (regex) {
      var incMatch = getProperty(search, "backwardInclude", true);
      regex = new RegExp(regex, flags);
      selectStart = 0;
      regex.lastIndex = 0;
      var result;
      while ((result=regex.exec(docText)) != null) {
        if (result.index >= offsetCursor) break;
        selectStart = incMatch ? result.index : regex.lastIndex;
      }
    }
    var selectEnd = editor.document.offsetAt(editor.selection.end);
    regex = getProperty(search, "forward")
    if (regex) {
      var incMatch = getProperty(search, "forwardInclude", true);
      regex = new RegExp(regex, flags);
      regex.lastIndex = selectEnd;
      selectEnd = docText.length;
      var result;
      while ((result=regex.exec(docText)) != null) {
        selectEnd = incMatch ? regex.lastIndex : result.index;
        break;
      }
    }
    var copyToClipboard = getProperty(search, "copyToClipboard", false);
    var hideSelectionAfterCopy = getProperty(search, "hideSelectionAfterCopy", false);

    if (copyToClipboard) {
      vscode.env.clipboard.writeText(docText.substring(selectStart, selectEnd)).then((v)=>v, (v)=>null);
    }
    if (hideSelectionAfterCopy && copyToClipboard) {
      editor.selection = new vscode.Selection(editor.document.positionAt(offsetCursor), editor.document.positionAt(offsetCursor));
    } else {
      editor.selection = new vscode.Selection(editor.document.positionAt(selectStart), editor.document.positionAt(selectEnd));
    }
  };

  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex1', (editor, edit, args) => { processRegEx(1, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex2', (editor, edit, args) => { processRegEx(2, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex3', (editor, edit, args) => { processRegEx(3, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex4', (editor, edit, args) => { processRegEx(4, editor);}) );
  context.subscriptions.push(vscode.commands.registerTextEditorCommand('selectby.regex5', (editor, edit, args) => { processRegEx(5, editor);}) );
};

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
