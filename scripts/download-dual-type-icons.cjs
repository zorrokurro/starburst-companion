const https = require('https');
const fs = require('fs');
const path = require('path');

const DUAL_ICONS = [
  { name: "暗影电", url: "https://patchwiki.biligame.com/images/seer/a/a7/g9v129dhmt789jx2749qogkkz5d3zs3.png" },
  { name: "暗影龙", url: "https://patchwiki.biligame.com/images/seer/e/e0/8kqenp59lmvaiv7z04jhfzu8rb3l33o.png" },
  { name: "暗影神秘", url: "https://patchwiki.biligame.com/images/seer/2/2a/7t6pgcqtm6asgb56r7ntphuehbwogh2.png" },
  { name: "暗影邪灵", url: "https://patchwiki.biligame.com/images/seer/0/0f/gx80gg30bu1rx220cnrqs96tlduh16o.png" },
  { name: "冰暗影", url: "https://patchwiki.biligame.com/images/seer/5/52/h9q4dmgap4ykdb645nggjfphwsfwrx3.png" },
  { name: "冰飞行", url: "https://patchwiki.biligame.com/images/seer/5/56/iq6qmrae1ltg69zfjnxadn70xfrsau7.png" },
  { name: "冰光", url: "https://patchwiki.biligame.com/images/seer/a/a1/6wwd4els66dmrtfkj9slh35t3ygm8cp.png" },
  { name: "冰火", url: "https://patchwiki.biligame.com/images/seer/7/7c/k2fd8hxnqhy4g3i4rjjm01j94o605np.png" },
  { name: "冰龙", url: "https://patchwiki.biligame.com/images/seer/c/c8/426f8vdoytcwrk4r61yw0zsijg8bukk.png" },
  { name: "冰神秘", url: "https://patchwiki.biligame.com/images/seer/8/87/be2pedpfkvxlulsh55wew2wna6xrya3.png" },
  { name: "草暗影", url: "https://patchwiki.biligame.com/images/seer/3/3a/0wgaq2ri12v9k739j42cl9fh7jlovi7.png" },
  { name: "草超能", url: "https://patchwiki.biligame.com/images/seer/2/22/ggrurh0q523ypamzpgregvbp1nc1sl0.png" },
  { name: "草机械", url: "https://patchwiki.biligame.com/images/seer/2/2d/41h5ziy799037m709q7q8mw08cwo6a1.png" },
  { name: "草战斗", url: "https://patchwiki.biligame.com/images/seer/c/c4/1vior1m2qn1c5mdt6fz3kdvyrslkbaa.png" },
  { name: "超能冰", url: "https://patchwiki.biligame.com/images/seer/3/3d/1vx48d36sk5jsm7mi29yr6d0uprqsi2.png" },
  { name: "次元龙", url: "https://patchwiki.biligame.com/images/seer/d/d3/r7tsiu66coglq19u3xaco4dwpoc9x1g.png" },
  { name: "次元战斗", url: "https://patchwiki.biligame.com/images/seer/a/a9/6kxwqulax2riwo2l26wji9bnxh998hy.png" },
  { name: "地面暗影", url: "https://patchwiki.biligame.com/images/seer/7/76/bv7zm71iemq3mq1yzs39gzsu9l6eaku.png" },
  { name: "地面超能", url: "https://patchwiki.biligame.com/images/seer/8/82/gpnwwefr591t6l5lp8iqqh5eoftbsum.png" },
  { name: "地面龙", url: "https://patchwiki.biligame.com/images/seer/f/fd/1wa27buygto1kk07actkbqmmrkx5b9f.png" },
  { name: "地面神秘", url: "https://patchwiki.biligame.com/images/seer/a/a3/70z6mlw1a32zbumywid25nzxnfkyn0d.png" },
  { name: "电冰", url: "https://patchwiki.biligame.com/images/seer/8/86/1s4tzibzj3n11rb8y253wctque4l1rt.png" },
  { name: "电次元", url: "https://patchwiki.biligame.com/images/seer/3/35/iqdhj9s76bcu9g96159msk742hrxr6m.png" },
  { name: "电火", url: "https://patchwiki.biligame.com/images/seer/4/4a/jnc7iexkl6ekl0rdwag622c3qf0fx40.png" },
  { name: "电机械", url: "https://patchwiki.biligame.com/images/seer/c/cc/2gogf5qenfjupnbfeyn2uo83ye3d4ta.png" },
  { name: "电龙", url: "https://patchwiki.biligame.com/images/seer/0/08/ipivsokj4jnewl7pwuc91o6jwrunlzc.png" },
  { name: "电战斗", url: "https://patchwiki.biligame.com/images/seer/b/b8/mnb4kzmknqqhuycrjbn6svjx6zua5ge.png" },
  { name: "飞行暗影", url: "https://patchwiki.biligame.com/images/seer/7/77/4mkweb58eo8l278ter4vwi1kn1eg5o3.png" },
  { name: "飞行超能", url: "https://patchwiki.biligame.com/images/seer/b/b5/jetigmq1wiara5dbzodod4pzja6d5h5.png" },
  { name: "飞行电", url: "https://patchwiki.biligame.com/images/seer/7/71/jjvxe3me83kxibudve87qgahbshhj1o.png" },
  { name: "飞行龙", url: "https://patchwiki.biligame.com/images/seer/8/87/kzgqe6w08x0ue7dlllcss0npchx1d1v.png" },
  { name: "飞行神秘", url: "https://patchwiki.biligame.com/images/seer/a/ab/rocan9fie62ffcazgx8dh9vhot233jp.png" },
  { name: "光暗影", url: "https://patchwiki.biligame.com/images/seer/2/22/p3f75v0dktpqw1lzajs2is3qr8eef71.png" },
  { name: "光超能", url: "https://patchwiki.biligame.com/images/seer/7/7c/larvy0qxtrrwei17onni3gysachfoiw.png" },
  { name: "光次元", url: "https://patchwiki.biligame.com/images/seer/3/34/rfoavtxadwyomelffvbwat0pmt258cf.png" },
  { name: "光飞行", url: "https://patchwiki.biligame.com/images/seer/a/ab/as0expd5zinfjo8ejyv41qbw83hwa58.png" },
  { name: "光火", url: "https://patchwiki.biligame.com/images/seer/d/dd/ncv4ccm80mi2ps4is51u1so5nwx2zwg.png" },
  { name: "光神秘", url: "https://patchwiki.biligame.com/images/seer/c/cf/66f8t4idi8jcreko22t3unejhsqhmug.png" },
  { name: "光战斗", url: "https://patchwiki.biligame.com/images/seer/8/8b/7lvaa2vpvdrc44p6iwq3rew68fz7dnm.png" },
  { name: "混沌暗影", url: "https://patchwiki.biligame.com/images/seer/f/fd/gdxjiv4xrvw0jqzo5siw1um7kxhzliq.png" },
  { name: "混沌冰", url: "https://patchwiki.biligame.com/images/seer/6/66/h3oznjo24zo56i9jjrs45ily0pp6e9n.png" },
  { name: "混沌超能", url: "https://patchwiki.biligame.com/images/seer/3/33/q35v7rra8670ciwfuic1c3nt53dzmpr.png" },
  { name: "混沌次元", url: "https://patchwiki.biligame.com/images/seer/3/31/15jifc3whdlqwd6d3sqbsz64a5uy03w.png" },
  { name: "混沌地面", url: "https://patchwiki.biligame.com/images/seer/b/bd/myojzwcxd4cbherswvffsbmo09e3rog.png" },
  { name: "混沌飞行", url: "https://patchwiki.biligame.com/images/seer/d/dc/p2zv1s5qssswqvjlxaj670i2mqew0va.png" },
  { name: "混沌光", url: "https://patchwiki.biligame.com/images/seer/3/31/8e1oclflsktn9o8urptukytulo05ro4.png" },
  { name: "混沌火", url: "https://patchwiki.biligame.com/images/seer/9/92/s8tky3w9ogl80pdur3yzqbsvt3i2dhw.png" },
  { name: "混沌龙", url: "https://patchwiki.biligame.com/images/seer/6/6d/l8p440hzw4lrwbhxpsvzeps0uwc89iy.png" },
  { name: "混沌圣灵", url: "https://patchwiki.biligame.com/images/seer/f/f2/jex29s0opwb5sm897cviq56wa73srfo.png" },
  { name: "混沌邪灵", url: "https://patchwiki.biligame.com/images/seer/9/96/tr68xdensrnqe5k3gv9jqecon4jxqnl.png" },
  { name: "混沌远古", url: "https://patchwiki.biligame.com/images/seer/a/a6/994k0mo2c7sbf5prxkoogp4hruhnok9.png" },
  { name: "混沌战斗", url: "https://patchwiki.biligame.com/images/seer/a/aa/itoxxx2yab2x9z4x2mxev57kiqc0soq.png" },
  { name: "火暗影", url: "https://patchwiki.biligame.com/images/seer/a/a5/3hayeob0jergd4evp0tqhhnf6yqas52.png" },
  { name: "火超能", url: "https://patchwiki.biligame.com/images/seer/0/08/2urdeo9um1d87fbrevlijnxxqb10xjt.png" },
  { name: "火虫", url: "https://patchwiki.biligame.com/images/seer/7/72/1p0iq1mqm0xq3zraoopugl9r04qrj6r.png" },
  { name: "火飞行", url: "https://patchwiki.biligame.com/images/seer/f/f1/g5zehqp678qedzkyjtb4saexcco1yq3.png" },
  { name: "火机械", url: "https://patchwiki.biligame.com/images/seer/1/10/dg1awjx4xwck31dw0w152zfce4zua5t.png" },
  { name: "火龙", url: "https://patchwiki.biligame.com/images/seer/b/bc/01slw657mara0hbffxdanbtuop1lu3h.png" },
  { name: "火神秘", url: "https://patchwiki.biligame.com/images/seer/9/94/aca2mh68m0sxs1kwlkdfclzluo01y5p.png" },
  { name: "机械超能", url: "https://patchwiki.biligame.com/images/seer/6/63/t6b2qz8di4ff63wa8noxcvjnwfoq54k.png" },
  { name: "机械次元", url: "https://patchwiki.biligame.com/images/seer/5/52/j9nkyr4fmbyaz3hpuvs898g3mrxho7b.png" },
  { name: "机械地面", url: "https://patchwiki.biligame.com/images/seer/1/1e/4t0we2b73e654mg0kk971f9xql97gyz.png" },
  { name: "机械龙", url: "https://patchwiki.biligame.com/images/seer/8/8e/nwho0xi8as2y9qtr1x2pz1vi9d2iptw.png" },
  { name: "机械神秘", url: "https://patchwiki.biligame.com/images/seer/1/1d/p4m1i9qmdzh6ss7quvnl025r1w4dkvu.png" },
  { name: "机械战斗", url: "https://patchwiki.biligame.com/images/seer/c/cb/jglk50fovgyhsbnniza9nvyaj4bm2oa.png" },
  { name: "神秘超能", url: "https://patchwiki.biligame.com/images/seer/e/e9/h3l1n9ea8ykvuakuldqomojiualzy98.png" },
  { name: "神秘轮回", url: "https://patchwiki.biligame.com/images/seer/b/bf/h4z936s9wyqgnyqopde1rpccdajjuuq.png" },
  { name: "神秘战斗", url: "https://patchwiki.biligame.com/images/seer/2/2c/8162img7acwe8lw2h8ywoax1jvajk66.png" },
  { name: "圣灵暗影", url: "https://patchwiki.biligame.com/images/seer/b/b0/1mu1xcjgy1jfoair8gq9bt4bkhclw2g.png" },
  { name: "圣灵超能", url: "https://patchwiki.biligame.com/images/seer/e/e4/3mhh2ff7mhdrfa3bctwkxhqgqswdwjq.png" },
  { name: "圣灵次元", url: "https://patchwiki.biligame.com/images/seer/8/83/8vwovs3pxa90a5i5ijsokk1hsyfjb4k.png" },
  { name: "圣灵地面", url: "https://patchwiki.biligame.com/images/seer/9/96/2gxis2uhjvrofn251atd9t88cnh57s3.png" },
  { name: "圣灵电", url: "https://patchwiki.biligame.com/images/seer/0/06/hln8qzttrxsng5lwcp5xlamjg142ttl.png" },
  { name: "圣灵飞行", url: "https://patchwiki.biligame.com/images/seer/a/a9/178x954jx1him9gm0i3yw5znduy1atg.png" },
  { name: "圣灵光", url: "https://patchwiki.biligame.com/images/seer/3/30/96lr5tbgz3if9jgqk3eamturbbh5ftr.png" },
  { name: "圣灵火", url: "https://patchwiki.biligame.com/images/seer/a/aa/i60cnkn9jq5ql94y2bx2wetrqukf8v5.png" },
  { name: "圣灵轮回", url: "https://patchwiki.biligame.com/images/seer/f/f0/gnbdnq5refkrw43mw31baledyyamnyp.png" },
  { name: "圣灵神秘", url: "https://patchwiki.biligame.com/images/seer/7/7c/lit5m38no9l30z46lp5w4d578rdsdzg.png" },
  { name: "圣灵战斗", url: "https://patchwiki.biligame.com/images/seer/3/39/ld4kpkfsjq1ppw5ttsem2bjuevt9s98.png" },
  { name: "水暗影", url: "https://patchwiki.biligame.com/images/seer/a/a0/9e507pg8zbjr0o0kvc2fvv20wm8jpm6.png" },
  { name: "水超能", url: "https://patchwiki.biligame.com/images/seer/9/9e/aaad37t7xa34si1n0l5my2puj4z2i8r.png" },
  { name: "水次元", url: "https://patchwiki.biligame.com/images/seer/1/19/nucya1trgnxp44zpnm76fl5af0hvvix.png" },
  { name: "水机械", url: "https://patchwiki.biligame.com/images/seer/d/d8/r7rsnhrb7y89oqmm6h8b2gbn6rm5inz.png" },
  { name: "水龙", url: "https://patchwiki.biligame.com/images/seer/b/bb/tuxq4qyd18r8akesdn5vxjq3orjy9b8.png" },
  { name: "水神秘", url: "https://patchwiki.biligame.com/images/seer/6/69/4zv26ovpw10eqm93m2xuuu0pl4ig5ou.png" },
  { name: "水战斗", url: "https://patchwiki.biligame.com/images/seer/0/06/n7miwet9xocllys4bnis576ltsaeno7.png" },
  { name: "邪灵机械", url: "https://patchwiki.biligame.com/images/seer/5/55/4b488h099merfbbal9m97xsxwy3fv4a.png" },
  { name: "邪灵龙", url: "https://patchwiki.biligame.com/images/seer/3/31/bpunedc412ctq98dnu0jmhmu5xv36ki.png" },
  { name: "邪灵神秘", url: "https://patchwiki.biligame.com/images/seer/d/da/958mtrf78et1rsskbqb9bogm4lvjbpu.png" },
  { name: "虚空混沌", url: "https://patchwiki.biligame.com/images/seer/a/a5/ee3xgtajj3h8ji6b661wpr8hisuiflc.png" },
  { name: "虚空邪灵", url: "https://patchwiki.biligame.com/images/seer/2/2e/6dtpxiqfdaqr5r3aws7osmkk3t8zcae.png" },
  { name: "远古草", url: "https://patchwiki.biligame.com/images/seer/a/a9/jkqvljdctwuacbji83fbwsvnqgxmdex.png" },
  { name: "远古地面", url: "https://patchwiki.biligame.com/images/seer/1/10/g9ydl26k5894fq0z2ls50iuo1nwc50y.png" },
  { name: "远古电", url: "https://patchwiki.biligame.com/images/seer/c/c8/q5a7x3futunq3ejsjcv9hrld0ng50al.png" },
  { name: "远古光", url: "https://patchwiki.biligame.com/images/seer/3/34/o4etwsq1l7r0zt831d2l5kq7iwmq5dc.png" },
  { name: "远古火", url: "https://patchwiki.biligame.com/images/seer/f/f1/cgxyxyfynqjwp5qaadf40yqs3prpkkd.png" },
  { name: "远古机械", url: "https://patchwiki.biligame.com/images/seer/7/70/nrp2kwls6vjlhn3w8fieg92mzii2yxt.png" },
  { name: "远古龙", url: "https://patchwiki.biligame.com/images/seer/f/f5/p4cz380hh3k1nltavr85s434aqg0z3z.png" },
  { name: "远古神秘", url: "https://patchwiki.biligame.com/images/seer/d/d4/2ku24snnxik7f2k8o69lk1wv0z9degj.png" },
  { name: "远古圣灵", url: "https://patchwiki.biligame.com/images/seer/a/a0/tvodmcv6pmh9yeykxo6lo4adc71jh8f.png" },
  { name: "远古邪灵", url: "https://patchwiki.biligame.com/images/seer/d/da/adyl3wa8svx41hm9bm5f9hnmb4yeb5v.png" },
  { name: "远古战斗", url: "https://patchwiki.biligame.com/images/seer/2/21/h6kf241qgt79a588zvp9snhm8br7hgi.png" },
  { name: "战斗暗影", url: "https://patchwiki.biligame.com/images/seer/4/47/o9mxhq4t4zxx61f4t02tvlt2gq9bs2q.png" },
  { name: "战斗地面", url: "https://patchwiki.biligame.com/images/seer/8/8c/p1eqnzdoa0duav80751k9gdl0pc63xh.png" },
  { name: "战斗火", url: "https://patchwiki.biligame.com/images/seer/a/a4/ce6x8b710e19fliq5as46taz7qzczaw.png" },
  { name: "战斗龙", url: "https://patchwiki.biligame.com/images/seer/7/76/a39clayc1k9ey04tru578y6635xgj8f.png" },
  { name: "战斗自然", url: "https://patchwiki.biligame.com/images/seer/6/6e/5mxoojb1ao0wa77imxxe62pmsheol62.png" },
  { name: "自然冰", url: "https://patchwiki.biligame.com/images/seer/4/41/7ovba4suxw91e9b5i6x6w8omgsux8rk.png" },
  { name: "自然超能", url: "https://patchwiki.biligame.com/images/seer/2/2c/frf4hel8szp2q5w57dakjczc1pf6q1a.png" },
  { name: "自然龙", url: "https://patchwiki.biligame.com/images/seer/7/72/319t8u4nh5nz0jftrko8ldoyg07dap6.png" },
  { name: "自然神秘", url: "https://patchwiki.biligame.com/images/seer/6/68/4txsd3qkpi8d61qd49vugowkq2qkv0b.png" },
  { name: "自然圣灵", url: "https://patchwiki.biligame.com/images/seer/a/a0/15iicnx3xsgomx0so7ylbadt16gaa75.png" },
];

// Simplified → Traditional mapping for single types
const SIMP_TO_TRAD = {
  '冰': '冰', '暗影': '暗影', '龙': '龍', '神秘': '神秘', '邪灵': '邪靈',
  '草': '草', '超能': '超能', '机械': '機械', '战斗': '戰鬥',
  '次元': '次元', '地面': '地面', '电': '電', '飞行': '飛行',
  '光': '光', '混沌': '混沌', '火': '火', '圣灵': '聖靈',
  '水': '水', '虚空': '虛空', '远古': '遠古', '自然': '自然',
  '轮回': '輪迴', '虫': '蟲', '王': '王', '普通': '普通',
};

function tradName(simpName) {
  // Split simplified dual name into two types and convert each
  // e.g. "战斗地面" → "戰鬥" + "地面"
  // Need to try matching longest type names first
  const typeOrder = ['暗影','超能','次元','地面','混沌','圣灵','虚空','远古','邪灵','轮回','机械','战斗','飞行','神秘','普通','冰','草','电','火','水','光','龙','虫','王'];
  let result = '';
  let remaining = simpName;
  for (const t of typeOrder) {
    if (remaining.startsWith(t)) {
      result += SIMP_TO_TRAD[t] || t;
      remaining = remaining.slice(t.length);
      break;
    }
  }
  // remaining should be the second type
  for (const t of typeOrder) {
    if (remaining === t) {
      result += SIMP_TO_TRAD[t] || t;
      break;
    }
  }
  return result;
}

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
  const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'types-dual');
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Downloading ${DUAL_ICONS.length} dual-type icons to ${OUTPUT_DIR}...\n`);

  let success = 0;
  let fail = 0;
  const nameMap = {}; // simpName → tradName mapping for reference

  for (const { name, url } of DUAL_ICONS) {
    const trad = tradName(name);
    nameMap[name] = trad;
    // Save as simplified name to match BWIKI convention (we'll map in JS)
    const dest = path.join(OUTPUT_DIR, `${name}.png`);

    try {
      await downloadFile(url, dest);
      const size = fs.statSync(dest).size;
      console.log(`  ✓ ${name}.png → ${trad}.png (${(size / 1024).toFixed(1)} KB)`);
      success++;
    } catch (err) {
      console.log(`  ✗ ${name}.png FAILED: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${success} success, ${fail} failed`);
  console.log('\nName mapping (simp → trad):');
  console.log(JSON.stringify(nameMap, null, 2));
}

main().catch(console.error);
