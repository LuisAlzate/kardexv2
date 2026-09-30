const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'src', 'screens');
const files = fs.readdirSync(screensDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const filePath = path.join(screensDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    let modified = false;

    // 1. Replace import
    if (content.includes('SQLiteMovementRepository')) {
        content = content.replace(/SQLiteMovementRepository/g, 'getMovementRepository');
        modified = true;
    }

    // 2. Add useAuth import if not present but we need isOnline
    if (modified && !content.includes("useAuth")) {
        // Find last import
        const lastImportIndex = content.lastIndexOf('import ');
        const endOfImport = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, endOfImport) + "\nimport { useAuth } from '../context/AuthContext';" + content.slice(endOfImport);
    }

    // 3. Extract isOnline in the main component body
    // We look for the component definition: const MainScreen = () => { or export default function MainScreen() {
    if (modified) {
        const componentMatch = content.match(/const\s+\w+\s*=\s*(?:<[^>]*>\s*)?\([^)]*\)\s*=>\s*{|export\s+default\s+function\s+\w+\s*\([^)]*\)\s*{/);
        if (componentMatch) {
            const insertionPoint = componentMatch.index + componentMatch[0].length;
            // Check if isOnline is already extracted
            if (!content.includes('isOnline } = useAuth()')) {
                // Check if useAuth is already called
                if (content.includes('useAuth()')) {
                    content = content.replace(/const\s+{([^}]*)}\s*=\s*useAuth\(\);/, (match, p1) => {
                        if (!p1.includes('isOnline')) {
                            return `const { ${p1.trim()}, isOnline } = useAuth();`;
                        }
                        return match;
                    });
                } else {
                    content = content.slice(0, insertionPoint) + "\n    const { isOnline } = useAuth();" + content.slice(insertionPoint);
                }
            }
        }

        // 4. Replace instantiation
        // const db = await SQLite.openDatabaseAsync('kardex.db');
        // const repo = new getMovementRepository(db); -> const repo = await getMovementRepository(isOnline);
        content = content.replace(/const\s+db\s*=\s*await\s+SQLite\.openDatabaseAsync\([^)]+\);\s*const\s+repo\s*=\s*new\s+getMovementRepository\(db\);/g, 'const repo = await getMovementRepository(isOnline);');
        
        // Sometimes it's without db var if reused
        content = content.replace(/const\s+repo\s*=\s*new\s+getMovementRepository\([^)]*\);/g, 'const repo = await getMovementRepository(isOnline);');

        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${file}`);
    }
}
console.log('All screens updated for DI.');
