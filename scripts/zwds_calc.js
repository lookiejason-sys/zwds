/**
 * zwds_calc.js — 紫微斗數排盤計算引擎 v1.2
 * ZWDS Chart Calculator Engine v1.2
 * 
 * 功能：公曆→農曆轉換、十四主星、輔星、四化、大限、流年
 * 
 * Dependencies: chinese-lunar-calendar (npm)
 * 
 * Usage:
 *   node zwds_calc.js [--year Y] [--month M] [--day D] [--hour H] [--min M] [--gender male|female]
 *   Default: Gregorian input. Use --lunar for direct lunar input.
 *   Output: JSON
 * 
 * Example:
 *   node zwds_calc.js --year 1977 --month 4 --day 18 --hour 19 --min 30 --gender male
 */

const { getLunar } = require('chinese-lunar-calendar');

// ====== 常量 ======
const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ZHI_NAMES = ['','子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// ====== 六十甲子納音 ======
const JIA_ZI_NA_YIN = [
  ['甲子','乙丑','海中金'],['丙寅','丁卯','爐中火'],['戊辰','己巳','大林木'],
  ['庚午','辛未','路旁土'],['壬申','癸酉','劍鋒金'],['甲戌','乙亥','山頭火'],
  ['丙子','丁丑','澗下水'],['戊寅','己卯','城牆土'],['庚辰','辛巳','白臘金'],
  ['壬午','癸未','楊柳木'],['甲申','乙酉','泉中水'],['丙戌','丁亥','屋上土'],
  ['戊子','己丑','霹靂火'],['庚寅','辛卯','松柏木'],['壬辰','癸巳','長流水'],
  ['甲午','乙未','沙中金'],['丙申','丁酉','山下火'],['戊戌','己亥','平地木'],
  ['庚子','辛丑','壁上土'],['壬寅','癸卯','金箔金'],['甲辰','乙巳','覆燈火'],
  ['丙午','丁未','天河水'],['戊申','己酉','大驛土'],['庚戌','辛亥','釵釧金'],
  ['壬子','癸丑','桑柘木'],['甲寅','乙卯','大溪水'],['丙辰','丁巳','沙中土'],
  ['戊午','己未','天上火'],['庚申','辛酉','石榴木'],['壬戌','癸亥','大海水']
];
const NA_YIN_LOOKUP = {};
JIA_ZI_NA_YIN.forEach(([g1,g2,ny]) => { NA_YIN_LOOKUP[g1]=ny; NA_YIN_LOOKUP[g2]=ny; });

function naYinToJu(name) {
  if (name.includes('金')) return 4;
  if (name.includes('木')) return 3;
  if (name.includes('水')) return 2;
  if (name.includes('火')) return 6;
  if (name.includes('土')) return 5;
  return 0;
}

// ====== 天干地支 ======
function getYearGanZhi(year) {
  const offset = (year - 1984) % 60;
  return {
    gan: GAN[((offset % 10) + 10) % 10],
    zhi: ZHI[((offset % 12) + 12) % 12],
    ganIdx: ((offset % 10) + 10) % 10,
    zhiIdx: ((offset % 12) + 12) % 12
  };
}

function getDayGanZhi(year, month, day) {
  const base = new Date(Date.UTC(2000, 0, 1));
  const target = new Date(Date.UTC(year, month - 1, day));
  const diff = Math.round((target - base) / 86400000);
  return {
    gan: GAN[((diff % 10) + 10) % 10],
    zhi: ZHI[((diff % 12) + 12) % 12],
    ganIdx: ((diff % 10) + 10) % 10,
    zhiIdx: ((diff % 12) + 12) % 12
  };
}

function getMonthGanZhi(yearGanIdx, lunarMonth) {
  // 五虎遁
  const start = [2,4,6,8,0];
  const ganIdx = (start[yearGanIdx % 5] + lunarMonth - 1) % 10;
  return {
    gan: GAN[ganIdx],
    zhi: ZHI[(lunarMonth + 1) % 12],
    ganIdx,
    zhiIdx: (lunarMonth + 1) % 12
  };
}

function getHourGanZhi(dayGanIdx, hourZhiIdx_1_12) {
  // 五鼠遁：hourZhiIdx 1-12 (子1...亥12)，轉0-11
  const start = [0,2,4,6,8];
  const ganIdx = (start[dayGanIdx % 5] + (hourZhiIdx_1_12 - 1)) % 10;
  return {
    gan: GAN[ganIdx],
    zhi: ZHI[(hourZhiIdx_1_12 - 1) % 12],
    ganIdx,
    zhiIdx: (hourZhiIdx_1_12 - 1) % 12
  };
}

function getHourZhi(hour24) {
  // 子1,丑2,...,亥12
  return Math.floor(((hour24 + 1) % 24) / 2) + 1;
}

// ====== 紫微星 ======
function getZiWeiZhi(ju, lunarDay) {
  const shang = Math.floor((lunarDay - 1) / ju);
  const yu = (lunarDay - 1) % ju;
  const offset = (yu === 0) ? shang : -(ju - yu);
  let pos = 3 + offset; // 寅=3
  while (pos > 12) pos -= 12;
  while (pos < 1) pos += 12;
  return pos;
}

// ====== 十四主星 ======
function get14Stars(zwZhi) {
  function n(v) { while (v>12) v-=12; while (v<1) v+=12; return v; }
  const s = {};
  s['紫微'] = n(zwZhi);
  s['天機'] = n(zwZhi - 2);
  s['太陽'] = n(zwZhi - 4);
  s['武曲'] = n(zwZhi - 6);
  s['天同'] = n(zwZhi - 8);
  s['廉貞'] = n(zwZhi - 10);
  const tfMap = {1:1,2:12,3:5,4:10,5:3,6:8,7:7,8:6,9:9,10:4,11:11,12:2};
  const tf = tfMap[zwZhi];
  s['天府'] = n(tf);
  s['太陰'] = n(tf + 1);
  s['貪狼'] = n(tf + 2);
  s['巨門'] = n(tf + 3);
  s['天相'] = n(tf + 4);
  s['天梁'] = n(tf + 5);
  s['七殺'] = n(tf + 6);
  s['破軍'] = n(tf + 7);
  return s;
}

// ====== 命宮、身宮、十二宮 ======
function getMingGong(lunarMonth, hourZhi, isMale, isYangYear) {
  let mp = 3 + (lunarMonth - 1);
  while (mp > 12) mp -= 12;
  const isForward = (isMale && isYangYear) || (!isMale && !isYangYear);
  let mg = isForward ? mp + (hourZhi - 1) : mp - (hourZhi - 1);
  while (mg < 1) mg += 12;
  while (mg > 12) mg -= 12;
  return mg;
}

function getShenGong(lunarMonth, hourZhi) {
  let mp = 3 + (lunarMonth - 1);
  while (mp > 12) mp -= 12;
  let sg = mp + (hourZhi - 1);
  while (sg > 12) sg -= 12;
  return sg;
}

function get12Palaces(mgZhi) {
  const names = ['命宮','兄弟','夫妻','子女','財帛','疾厄','遷移','交友','官祿','田宅','福德','父母'];
  const p = {};
  for (let i = 0; i < 12; i++) {
    let z = mgZhi - i;
    while (z < 1) z += 12;
    p[names[i]] = z;
  }
  return p;
}

// ====== 輔星 ======
function getAuxiliaryStars(yearGanIdx, yearZhiIdx, lunarMonth, hourZhi_1_12) {
  const h = hourZhi_1_12;
  const r = {};
  function n(v) { while(v>12) v-=12; while(v<1) v+=12; return v; }

  // 祿存
  const luCunMap = [3,4,6,7,6,7,9,10,12,1];
  const lc = luCunMap[yearGanIdx];
  r['祿存'] = lc;
  r['擎羊'] = n(lc + 1);
  r['陀羅'] = n(lc - 1);

  // 文昌 戌(11)起子順
  r['文昌'] = n(11 + (h - 1));
  // 文曲 辰(5)起子逆
  r['文曲'] = n(5 - (h - 1));
  // 左輔 辰(5)起子順
  r['左輔'] = n(5 + (h - 1));
  // 右弼 戌(11)起子逆
  r['右弼'] = n(11 - (h - 1));

  // 天魁天鉞
  const tk_tm = [
    {k:8,m:2},{k:9,m:1},{k:10,m:12},{k:10,m:12},
    {k:6,m:4},{k:9,m:1},{k:8,m:2},{k:7,m:3},
    {k:6,m:4},{k:6,m:4}
  ];
  r['天魁'] = tk_tm[yearGanIdx].k;
  r['天鉞'] = tk_tm[yearGanIdx].m;

  // 火星 (生年支)
  const yz = yearZhiIdx + 1;
  const hm = [3,7,11];
  const sjc = [9,1,5];
  const sych = [6,10,2];
  const hmj = [12,4,8];
  if (hm.includes(yz)) r['火星'] = n(1 + (lunarMonth - 1));
  else if (sjc.includes(yz)) r['火星'] = n(3 - (lunarMonth - 1));
  else if (sych.includes(yz)) r['火星'] = n(4 - (lunarMonth - 1));
  else r['火星'] = n(10 - (lunarMonth - 1));

  // 鈴星
  if (hm.includes(yz)) r['鈴星'] = n(4 - (lunarMonth - 1));
  else if (sjc.includes(yz)) r['鈴星'] = n(3 - (lunarMonth - 1));
  else if (sych.includes(yz)) r['鈴星'] = n(11 - (lunarMonth - 1));
  else r['鈴星'] = n(6 - (lunarMonth - 1));

  return r;
}

// ====== 四化 ======
const SI_HUA = {
  '甲': ['廉貞','破軍','武曲','太陽'],
  '乙': ['天機','天梁','紫微','太陰'],
  '丙': ['天同','天機','文昌','廉貞'],
  '丁': ['太陰','天同','天機','巨門'],
  '戊': ['貪狼','太陰','右弼','天機'],
  '己': ['武曲','貪狼','天梁','文曲'],
  '庚': ['太陽','武曲','太陰','天同'],
  '辛': ['巨門','太陽','文曲','文昌'],
  '壬': ['天梁','紫微','左輔','武曲'],
  '癸': ['破軍','巨門','太陰','貪狼']
};

// ====== 大限 ======
function getDaXian(ju, mgZhi, isMale, isYangYear) {
  const dir = (isMale && isYangYear) || (!isMale && !isYangYear) ? 1 : -1;
  const list = [];
  let cur = mgZhi;
  let age = 1;
  for (let i = 0; i < 12; i++) {
    list.push({ palace: cur, startAge: age, endAge: age + ju - 1 });
    age += ju;
    cur = cur - dir;
    while (cur < 1) cur += 12;
    while (cur > 12) cur -= 12;
  }
  return list;
}

// ====== 流年 ======
function getLiuNianMG(yearZhiIdx) {
  // yearZhiIdx 0-11 -> 流年命宮 1-12
  const map = [3,4,5,6,7,8,9,10,11,12,1,2];
  return map[yearZhiIdx % 12];
}

// ====== 主入口 ======
function calculateChart(birthYear, birthMonth, birthDay, birthHour24, birthMinute, gender, isLunar) {
  const isMale = (gender === 'male' || gender === '男' || gender === 'M');
  
  let lunarYear, lunarMonth, lunarDay, lunarLeap;
  
  if (isLunar) {
    lunarYear = birthYear;
    lunarMonth = birthMonth;
    lunarDay = birthDay;
  } else {
    const conv = getLunar(birthYear, birthMonth, birthDay);
    if (!conv) throw new Error('Date conversion failed (year must be 1900-2100)');
    lunarYear = birthYear;
    lunarMonth = conv.lunarMonth;
    lunarDay = conv.lunarDate;
    lunarLeap = conv.isLeap;
  }
  
  if (!lunarMonth || !lunarDay) throw new Error('Invalid lunar date');
  
  const ygz = getYearGanZhi(lunarYear);
  const dgz = getDayGanZhi(birthYear, birthMonth, birthDay);
  const hZhi = getHourZhi(birthHour24);
  const hgz = getHourGanZhi(dgz.ganIdx, hZhi);
  const mgz = getMonthGanZhi(ygz.ganIdx, lunarMonth);
  
  const naYin = NA_YIN_LOOKUP[ygz.gan + ygz.zhi];
  const ju = naYinToJu(naYin);
  const isYangYear = ygz.ganIdx % 2 === 0;
  
  const mg = getMingGong(lunarMonth, hZhi, isMale, isYangYear);
  const sg = getShenGong(lunarMonth, hZhi);
  const zw = getZiWeiZhi(ju, lunarDay);
  const stars14 = get14Stars(zw);
  const palaces = get12Palaces(mg);
  const aux = getAuxiliaryStars(ygz.ganIdx, ygz.zhiIdx, lunarMonth, hZhi);
  
  const siHua = SI_HUA[ygz.gan];
  
  // 流年
  const targetYear = new Date().getFullYear();
  const age = targetYear - lunarYear + 1;
  const lygz = getYearGanZhi(targetYear);
  const lnMG = getLiuNianMG(lygz.zhiIdx);
  const lnSH = SI_HUA[lygz.gan];
  
  // 也可以指定年份
  const daxian = getDaXian(ju, mg, isMale, isYangYear);
  const cd = daxian.find(d => age >= d.startAge && age <= d.endAge) || {};
  
  const palNames = ['命宮','兄弟','夫妻','子女','財帛','疾厄','遷移','交友','官祿','田宅','福德','父母'];
  
  function n(v) { while(v>12) v-=12; while(v<1) v+=12; return v; }
  
  // 合併所有星到各宮
  const allStarPos = {};
  Object.entries(stars14).forEach(([k,v]) => { allStarPos[k] = n(v); });
  Object.entries(aux).forEach(([k,v]) => { allStarPos[k] = n(v); });
  
  function starsInPalace(palZhi) {
    const ms = [], ax = [];
    Object.entries(allStarPos).forEach(([k,v]) => {
      if (v === palZhi) {
        if (['紫微','天機','太陽','武曲','天同','廉貞','天府','太陰','貪狼','巨門','天相','天梁','七殺','破軍'].includes(k)) {
          ms.push(k);
        } else {
          ax.push(k);
        }
      }
    });
    return { mainStars: ms, auxStars: ax };
  }
  
  const palaceData = {};
  palNames.forEach(name => {
    const z = n(palaces[name]);
    const s = starsInPalace(z);
    palaceData[name] = { zhi: z, name: ZHI_NAMES[z], ...s };
  });
  
  return {
    birth: { year: birthYear, month: birthMonth, day: birthDay, hour: birthHour24, minute: birthMinute, gender, isLunarInput: isLunar },
    lunar: { year: lunarYear, month: lunarMonth, day: lunarDay, isLeap: lunarLeap, ganZhi: ygz.gan + ygz.zhi },
    ganzhi: { year: ygz.gan + ygz.zhi, month: mgz.gan + mgz.zhi, day: dgz.gan + dgz.zhi, hour: hgz.gan + hgz.zhi },
    wuXingJu: { naYin, ju, name: ['','水二局','','木三局','金四局','土五局','火六局'][ju] },
    mingGong: { zhi: mg, name: ZHI_NAMES[mg] },
    shenGong: { zhi: sg, name: ZHI_NAMES[sg] },
    stars14: Object.fromEntries(Object.entries(stars14).map(([k,v]) => [k, { zhi: n(v), name: ZHI_NAMES[n(v)] }])),
    auxiliaryStars: Object.fromEntries(Object.entries(aux).map(([k,v]) => [k, { zhi: n(v), name: ZHI_NAMES[n(v)] }])),
    palaces: palaceData,
    fourTransformations: { 化祿: siHua[0], 化權: siHua[1], 化科: siHua[2], 化忌: siHua[3] },
    daxian: daxian.map(d => ({ palace: ZHI_NAMES[n(d.palace)], range: d.startAge + '-' + d.endAge + '歲' })),
    currentDaxian: { palace: ZHI_NAMES[n(cd.palace)], range: cd.startAge ? cd.startAge + '-' + cd.endAge + '歲' : '', age },
    liuNian: {
      targetYear,
      ganzhi: lygz.gan + lygz.zhi,
      age,
      mingGong: lnMG,
      mingGongName: ZHI_NAMES[n(lnMG)],
      fourTransformations: { 化祿: lnSH[0], 化權: lnSH[1], 化科: lnSH[2], 化忌: lnSH[3] }
    }
  };
}

// ====== CLI ======
if (require.main === module) {
  const a = {};
  process.argv.slice(2).forEach((v,i,arr) => { if (v.startsWith('--')) a[v.slice(2)] = arr[i+1]; });
  try {
    const r = calculateChart(
      parseInt(a.year) || 1977, parseInt(a.month) || 4, parseInt(a.day) || 18,
      parseInt(a.hour) || 19, parseInt(a.min) || 30,
      a.gender || 'male', !!a.lunar
    );
    console.log(JSON.stringify(r, null, 2));
  } catch(e) {
    console.error(JSON.stringify({ error: e.message }));
  }
}

module.exports = { calculateChart };
