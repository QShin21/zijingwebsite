/** The layout mapper's expression subset; this does not compile a WeChat mini program. */
import vm from 'node:vm';
import ts from 'typescript';

const expressions = new Map();
const printer = ts.createPrinter({ removeComments: true });

function compile(body, object) {
  const key = (object ? 'object:' : 'value:') + body;
  if (expressions.has(key)) return expressions.get(key);
  const source = ts.createSourceFile('synthetic-wxml-expression.js', object ? '({' + body + '})' : '(' + body + ')', ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  if (source.parseDiagnostics.length || source.statements.length !== 1 || !ts.isExpressionStatement(source.statements[0])) throw new Error('Invalid WXML preview expression');
  // WXML resolves absent fields as undefined. Ordinary JS throws on missing
  // identifiers and null property paths, incorrectly dropping whole conditions.
  const transformed = ts.transform(source.statements[0].expression, [context => root => {
    const visit = node => {
      if (ts.isPropertyAccessExpression(node)) return ts.factory.createPropertyAccessChain(ts.visitNode(node.expression, visit), ts.factory.createToken(ts.SyntaxKind.QuestionDotToken), node.name);
      if (ts.isElementAccessExpression(node)) return ts.factory.createElementAccessChain(ts.visitNode(node.expression, visit), ts.factory.createToken(ts.SyntaxKind.QuestionDotToken), ts.visitNode(node.argumentExpression, visit));
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitNode(root, visit);
  }]);
  try {
    const code = printer.printNode(ts.EmitHint.Expression, transformed.transformed[0], source);
    expressions.set(key, code);
    return code;
  } finally { transformed.dispose(); }
}

export function evaluateWxmlExpression(expression, data, object = false) {
  const body = expression.trim().replace(/^\{\{/, '').replace(/\}\}$/, '');
  const scope = new Proxy(Object.assign(Object.create(null), data), {
    get: (target, property) => Reflect.get(target, property),
  });
  return vm.runInNewContext(compile(body, object), scope, { timeout: 300 });
}
