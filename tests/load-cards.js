const fs = require('node:fs');
const vm = require('node:vm');
const context = {window: {}};
for (const file of ['catalog.js', ...fs.readdirSync('cards').filter(f => /^task-\d+\.js$/.test(f))]) {
  vm.runInNewContext(fs.readFileSync('cards/' + file, 'utf8'), context, {filename: file});
}
module.exports = context.window.EGE_TRAINER_CARDS;
