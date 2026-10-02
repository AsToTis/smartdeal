const fs = require('fs');
const repl = `<Picker.Item label="เบเกอรี่" value="1" />
            <Picker.Item label="อาหารมื้อหลัก" value="2" />
            <Picker.Item label="ผลไม้" value="3" />
            <Picker.Item label="เครื่องดื่ม" value="4" />
            <Picker.Item label="ขนมหวาน" value="5" />`;

const f1 = 'src/app/(seller)/add-product.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = c1.replace(/<Picker\.Item label=".*?" value="1" \/>[\s\S]*?<Picker\.Item label=".*?" value="6" \/>/, repl);
fs.writeFileSync(f1, c1);

const f2 = 'src/app/(seller)/edit-product.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(/<Picker\.Item label=".*?" value="1" \/>[\s\S]*?<Picker\.Item label=".*?" value="6" \/>/, repl);
fs.writeFileSync(f2, c2);

console.log('Done');
