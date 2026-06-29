const https = require('https');
const fs = require('fs');
const path = require('path');

// BWIKI type icon URLs (full-size 318x318)
// Format: [chineseName, hash, filename]
const SINGLE_TYPE_ICONS = [
  ['草', '8/8a', '1rczsmsvp5jiiphfufrdt5ieb9a07ro.png'],
  ['水', 'f/f8', 'h0axzt5f2oe1w4gesmsuvt2pd9ja33g.png'],
  ['火', '5/55', 'ddrlxdoucd1ecgh025qbffbryl29aa7.png'],
  ['电', 'd/d2', '1xu31bttuckcv5i61hef2vsw7zvlorv.png'],
  ['冰', 'd/d0', '592ocgm1retvb53ul5c1kpk6abt566o.png'],
  ['战斗', '5/59', 'd16jtzan6muhtnzc9w5wrj4pme8lsn8.png'],
  ['飞行', 'b/b5', '8ibmuawnafhncvrnqpzqd5opwc776ic.png'],
  ['超能', '5/56', '5kdnay8pa908nclgetwz639xkl93sew.png'],
  ['虫', '5/5c', '11xe03wl3rxijtk7tff81hep6xyshcy.png'],
  ['光', 'a/a9', 'ng5xg884kvo1o76yb4b9e56qvn2lkk3.png'],
  ['暗影', 'e/e4', 'sq29m3ln0s9hznoty02bzwxgfe581kp.png'],
  ['圣灵', 'f/f6', 'lxyjsw490ubehkrepius8b34koywc4x.png'],
  ['次元', '6/6c', '3jtllxpzztz4a06asqwzi2hgos9pox8.png'],
  ['混沌', '1/19', 's3gd8zlri63a32mmp0kom5ozfsoutua.png'],
  ['自然', 'c/ce', 'sozl1z8v8a7eyfio4136ramh156i9bf.png'],
  ['远古', '2/20', '3mlkayvar7cpgfgbcws2u4drzjet8b9.png'],
  ['邪灵', '9/96', 'ernggb9z97sclxxc51zdwozka5lra1w.png'],
  ['王', '3/36', 'sr0b59uxoob7l06sn9wscx52jtnruwj.png'],
  ['神灵', 'c/c3', 'nfx5dyhmd3jf5fqlsapz1hlwjt0khqt.png'],
  ['轮回', '8/88', 'd7znbqzmb21i7nw1s0crbvzec8h3es2.png'],
  ['虚空', 'a/ab', 'm7o1o8zvka5ob43ebgrd8psyg11zkiv.png'],
  ['机械', '0/0b', 'c2ohwsguw5lbvox7j2zkxigphf3gjwf.png'],
  ['普通', '7/74', '3z9jp8lsx2r5wbedoqtjjvsxw4jgkto.png'],
  ['神秘', '5/5a', 'itn2rrg4xkfjflueg0kt6onu44ja7tx.png'],
  ['龙', '3/36', '26tmjbmn3832yk0352x30rubeknojrg.png'],
];

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'types');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
          res2.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Downloading ${SINGLE_TYPE_ICONS.length} type icons to ${OUTPUT_DIR}...\n`);

  let success = 0;
  let fail = 0;

  for (const [name, hash, filename] of SINGLE_TYPE_ICONS) {
    const url = `https://patchwiki.biligame.com/images/seer/${hash}/${filename}`;
    const dest = path.join(OUTPUT_DIR, `${name}.png`);

    try {
      await downloadFile(url, dest);
      const size = fs.statSync(dest).size;
      console.log(`  ✓ ${name}.png (${(size / 1024).toFixed(1)} KB)`);
      success++;
    } catch (err) {
      console.log(`  ✗ ${name}.png FAILED: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${success} success, ${fail} failed`);
}

main().catch(console.error);
