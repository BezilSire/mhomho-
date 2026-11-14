import fs from 'node:fs';

const blogPath = 'worker/src/blog.ts';
let blog = fs.readFileSync(blogPath, 'utf8');
blog = blog
  .split('MHOMHO Journal')
  .join('MHOMHO Blog')
  .split('>Journal<')
  .join('>Blog<')
  .split('Back to the Journal')
  .join('Back to the Blog');
fs.writeFileSync(blogPath, blog);

const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');
app = app.split("{ id: 'blog', label: 'Journal' }").join("{ id: 'blog', label: 'Blog' }");
fs.writeFileSync(appPath, app);

console.log('done');
