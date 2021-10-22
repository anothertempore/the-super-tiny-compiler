// 1. Parsing: raw code --> tokens --> AST
// 2. Transformation: AST --> new AST
// 3. Code Generation: new AST --> new code

/**
 * Raw code --> tokens
 *
 * @param {string} input Code string
 * @returns Tokens: an array of objects that describe syntax
 * @example
 *   input: '(add 2 (subtract 4 2))'
 *   output:
 *   [
 *     { name: 'paren', value: '(' },
 *     { name: 'name', value: 'add' },
 *     { name: 'number', value: '2' },
 *     { name: 'paren', value: '(' },
 *     { name: 'name', value: 'subtract' },
 *     { name: 'number', value: '4' },
 *     { name: 'number', value: '2' },
 *     { name: 'paren', value: ')' },
 *     { name: 'paren', value: ')' }
 *   ]
 */
function tokenizer(input) {
  let current = 0;
  let tokens = [];

  while (current < input.length) {
    let char = input[current];

    if (char === "(") {
      tokens.push({ type: "paren", value: "(" });
      current++;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "paren", value: ")" });
      current++;
      continue;
    }

    let WHITESPACE = /\s/;
    if (WHITESPACE.test(char)) {
      current++;
      continue;
    }

    let NUMBERS = /[0-9]/;
    if (NUMBERS.test(char)) {
      let value = "";

      while (NUMBERS.test(char)) {
        value += char;
        char = input[++current];
      }

      tokens.push({ type: "number", value });
      continue;
    }

    if (char === '"') {
      let value = "";

      // Skip the opening double quote
      char = input[++current];

      while (char !== '"') {
        value += char;
        char = input[++current];
      }

      // Skip the closing double quote
      char = input[++current];

      tokens.push({ type: "string", value });
      continue;
    }

    let LETTERS = /[a-z]/i;
    if (LETTERS.test(char)) {
      let value = "";

      while (LETTERS.test(char)) {
        value += char;
        char = input[++current];
      }

      tokens.push({ type: "name", value });
      continue;
    }

    throw new TypeError("I dont know what this character is: " + char);
  }

  return tokens;
}

/**
 * Tokens --> AST
 *
 * @param tokens An array of objects that describe the syntax
 * @returns AST: An nested object that describe the relations of syntax
 * @example
    input:
    [
      { name: 'paren', value: '(' },
      { name: 'name', value: 'add' },
      { name: 'number', value: '2' },
      { name: 'paren', value: '(' },
      { name: 'name', value: 'subtract' },
      { name: 'number', value: '4' },
      { name: 'number', value: '2' },
      { name: 'paren', value: ')' },
      { name: 'paren', value: ')' }
    ]
    output:
    {
      "type":"Program",
      "body":[
        {
          "type":"CallExpression",
          "name":"add",
          "params":[
            {
              "type":"NumberLiteral",
              "value":"2"
            },
            {
              "type":"CallExpression",
              "name":"subtract",
              "params":[
                {
                  "type":"NumberLiteral",
                  "value":"4"
                },
                {
                  "type":"NumberLiteral",
                  "value":"2"
                }
              ]
            }
          ]
        }
      ]
    }
 */
function parser(tokens) {
  let current = 0;

  function walk() {
    let token = tokens[current];

    if (token.type === "number") {
      current++;

      return {
        type: "NumberLiteral",
        value: token.value,
      };
    }

    if (token.type === "string") {
      current++;

      return {
        type: "StringLiteral",
        value: token.value,
      };
    }

    if (token.type === "paren" && token.value === "(") {
      // Skip the opening parenthesis
      token = tokens[++current];

      let node = {
        type: "CallExpression",
        name: token.value,
        params: [],
      };

      // Skip the name token
      token = tokens[++current];

      while (
        token.type !== "paren" ||
        (token.type === "paren" && token.value !== ")")
      ) {
        node.params.push(walk());
        token = tokens[current];
      }

      // Skip the closing parentheis
      current++;

      return node;
    }
  }

  let ast = {
    type: "Program",
    body: [],
  };

  while (current < tokens.length) {
    ast.body.push(walk());
  }

  return ast;
}

/**
 * {
      "type":"Program",
      "body":[
        {
          "type":"CallExpression",
          "name":"add",
          "params":[
            {
              "type":"NumberLiteral",
              "value":"2"
            },
            {
              "type":"CallExpression",
              "name":"subtract",
              "params":[
                {
                  "type":"NumberLiteral",
                  "value":"4"
                },
                {
                  "type":"NumberLiteral",
                  "value":"2"
                }
              ]
            }
          ]
        }
      ]
    }
 */

function traverser(ast, visitor) {
  function traverseArray(array, parent) {
    array.forEach((child) => {
      traverseNode(child, parent);
    });
  }

  function traverseNode(node, parent) {
    let methods = visitor[node.type];

    if (methods && methods.enter) {
      methods.enter(node, parent);
    }

    switch (node.type) {
      case "Program":
        traverseArray(node.body, node);
        break;
      case "CallExpression":
        traverseArray(node.params, node);
        break;
      case "NumberLiteral":
      case "StringLiteral":
        break;
      default:
        throw new TypeError(node.type);
    }

    if (methods && methods.exit) {
      methods.exit(node, parent);
    }
  }

  traverseNode(ast, null);
}

/**
 * old AST --> New AST
 * @param ast old AST
 */
function transformer(ast) {
  let newAst = {
    type: "Program",
    body: [],
  };

  // `_context` is a reference from the old ast to the new ast
  ast._context = newAst.body;

  traverser(ast, {
    NumberLiteral: {
      enter(node, parent) {
        parent._context.push({ type: "NumberLiteral", value: node.value });
      },
    },
    StringLiteral: {
      enter(node, parent) {
        parent._context.push({ type: "StringLiteral", value: node.value });
      },
    },
    CallExpression: {
      enter(node, parent) {
        let expression = {
          type: "CallExpression",
          callee: {
            type: "Identifier",
            name: node.name,
          },
          arguments: [],
        };

        node._context = expression.arguments;

        if (parent.type !== "CallExpression") {
          expression = {
            type: "ExpressionStatement",
            expression,
          };
        }

        parent._context.push(expression);
      },
    },
  });

  return newAst;
}

/**
 * new AST --> new code
 * @param node AST
 * @returns new code
 */
function codeGenerator(node) {
  switch (node.type) {
    case "Program":
      return node.body.map(codeGenerator).join("\n");
    case "ExpressionStatement":
      return codeGenerator(node.expression) + ";";
    case "CallExpression":
      return (
        codeGenerator(node.callee) +
        "(" +
        node.arguments.map(codeGenerator).join(", ") +
        ")"
      );
    case "Identifier":
      return node.name;
    case "NumberLiteral":
      return node.value;
    case "StringLiteral":
      return '"' + node.value + '"';
    default:
      throw new TypeError(node.type);
  }
}

function compiler(input) {
  const tokens = tokenizer(input);
  const ast = parser(tokens);
  const newAst = transformer(ast);
  const output = codeGenerator(newAst);
  return output;
}

const input = "(add 2 (subtract (add 4 2)))";
console.log("input:", input);
const output = compiler(input);
console.log("output:", output);
