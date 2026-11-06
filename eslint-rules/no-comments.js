const HASHBANG = new Set(['Shebang', 'Hashbang'])

const isHashbang = comment =>
  comment.loc.start.line === 1 &&
  comment.loc.start.column === 0 &&
  (HASHBANG.has(comment.type) ||
    (comment.type === 'Line' && comment.value.startsWith('!')))

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'This project has no code comments.' },
    schema: [],
    messages: { comment: 'This project has no code comments.' },
  },
  create: context => ({
    Program() {
      for (const comment of context.sourceCode.getAllComments()) {
        if (isHashbang(comment)) {
          continue
        }
        context.report({ loc: comment.loc, messageId: 'comment' })
      }
    },
  }),
}
