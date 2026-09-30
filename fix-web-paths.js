const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'index.html');

if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, 'utf8');
  
  // Reemplazar "/_expo/" con "_expo/"
  // Reemplazar "/favicon.ico" con "favicon.ico"
  content = content.replace(/src="\//g, 'src="');
  content = content.replace(/href="\//g, 'href="');
  
  fs.writeFileSync(indexPath, content);
  console.log('Paths fixed in dist/index.html');
} else {
  console.error('dist/index.html not found');
}
