# 生成测试用 EPUB:《三国演义》试读本(3 章,公版文本)
# 用法: powershell -File tools\make-test-epub.ps1
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$out = Join-Path (Split-Path -Parent $PSScriptRoot) 'test-books\sanguo-test.epub'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
if (Test-Path $out) { Remove-Item $out -Force }

$utf8 = New-Object System.Text.UTF8Encoding($false)

function New-EpubEntry($zip, $name, $content) {
  $level = if ($name -eq 'mimetype') { [System.IO.Compression.CompressionLevel]::NoCompression } else { [System.IO.Compression.CompressionLevel]::Optimal }
  $entry = $zip.CreateEntry($name, $level)
  $stream = $entry.Open()
  $bytes = $utf8.GetBytes($content)
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Dispose()
}

$fs = [System.IO.File]::Create($out)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)

New-EpubEntry $zip 'mimetype' 'application/epub+zip'
New-EpubEntry $zip 'META-INF/container.xml' @'
<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
'@
New-EpubEntry $zip 'OEBPS/content.opf' @'
<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:test-sanguo-001</dc:identifier>
    <dc:title>三国演义(试读本)</dc:title>
    <dc:creator>罗贯中</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">2026-09-06T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="c3" href="chapter3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
    <itemref idref="c3"/>
  </spine>
</package>
'@
New-EpubEntry $zip 'OEBPS/nav.xhtml' @'
<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head>
<body>
<nav epub:type="toc">
<h1>目录</h1>
<ol>
<li><a href="chapter1.xhtml">第一回 宴桃园豪杰三结义 斩黄巾英雄首立功</a></li>
<li><a href="chapter2.xhtml">第二回 张翼德怒鞭督邮 何国舅谋诛宦竖</a></li>
<li><a href="chapter3.xhtml">第三回 议温明董卓叱丁原 馈金珠李肃说吕布</a></li>
</ol>
</nav>
</body>
</html>
'@
New-EpubEntry $zip 'OEBPS/chapter1.xhtml' @'
<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第一回 宴桃园豪杰三结义</title></head>
<body>
<h2>第一回 宴桃园豪杰三结义 斩黄巾英雄首立功</h2>
<p>话说天下大势,分久必合,合久必分。周末七国分争,并入于秦。及秦灭之后,楚、汉分争,又并入于汉。汉朝自高祖斩白蛇而起义,一统天下,后来光武中兴,传至献帝,遂分为三国。</p>
<p>推其致乱之由,殆始于桓、灵二帝。桓帝禁锢善类,崇信宦官。及桓帝崩,灵帝即位,大将军窦武、太傅陈蕃共相辅佐。时有宦官曹节等弄权,窦武、陈蕃谋诛之,机事不密,反为所害,中涓自此愈横。</p>
<p>建宁二年四月望日,帝御温德殿。方升座,殿角狂风骤起。只见一条大青蛇,从梁上飞将下来,蟠于椅上。帝惊倒,左右急救入宫,百官俱奔避。须臾,蛇不见了。忽然大雷大雨,加以冰雹,落到半夜方止,坏却房屋无数。</p>
<p>却说张角本是个不第秀才,因入山采药,遇一老人,碧眼童颜,手执藜杖,唤角至一洞中,以天书三卷授之,曰:「此名《太平要术》,汝得之,当代天宣化,普救世人;若萌异心,必获恶报。」角拜问姓名。老人曰:「吾乃南华老仙也。」言讫,化阵清风而去。</p>
<p>角得此书,晓夜攻习,能呼风唤雨,号为「太平道人」。中平元年正月内,疫气流行,张角散施符水,为人治病,自称「大贤良师」。角有徒弟五百余人,云游四方,皆能书符念咒。</p>
<p>且说涿郡人刘玄德,即刘备,字玄德,汉景帝阁下玄孙,性宽和,寡言语,喜怒不形于色;素有大志,专好结交天下豪杰。与河东关羽(字云长)、涿郡张飞(字翼德)二人,于桃园中结为异姓兄弟。</p>
<p>次日,于桃园中,备下乌牛白马祭礼等项,三人焚香再拜而说誓曰:「念刘备、关羽、张飞,虽然异姓,既结为兄弟,则同心协力,救困扶危;上报国家,下安黎庶。不求同年同月同日生,只愿同年同月同日死。皇天后土,实鉴此心,背义忘恩,天人共戮!」誓毕,拜玄德为兄,关羽次之,张飞为弟。祭罢天地,复宰牛设酒,聚乡中勇士,得三百余人,就桃园中痛饮一醉。</p>
</body>
</html>
'@
New-EpubEntry $zip 'OEBPS/chapter2.xhtml' @'
<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第二回 张翼德怒鞭督邮</title></head>
<body>
<h2>第二回 张翼德怒鞭督邮 何国舅谋诛宦竖</h2>
<p>且说董卓字仲颖,陇西临洮人也,官拜河东太守,自来骄傲。当日怠慢了玄德,张飞性发,便欲杀之。玄德与关公急止之曰:「他是朝廷命官,岂可擅杀?」飞曰:「若不杀这厮,反要在他部下听令,其实不甘!二兄要便住在此,我自投别处去也!」玄德曰:「我三人义同生死,岂可相离?不若都投别处去便了。」飞曰:「若如此,稍解吾恨。」于是三人连夜引军来投朱俊。</p>
<p>却说张飞饮了数杯闷酒,乘马从馆驿前过,见五六十个老人,皆在门前痛哭。飞问其故,众老人答曰:「督邮逼勒县吏,欲害刘公;我等皆来苦告,不得放入,反遭把门人赶打!」</p>
<p>张飞大怒,睁圆环眼,咬碎钢牙,滚鞍下马,径入馆驿,把门人那里阻挡得住,直奔后堂,见督邮正坐厅上,将县吏绑倒在地。飞大喝:「害民贼!认得我么?」督邮未及开言,早被张飞揪住头发,扯出馆驿,直到县前马桩上缚住;攀下柳条,去督邮两腿上着力鞭打,一连打折柳条十数枝。</p>
<p>玄德正纳闷间,听得县前喧闹,问左右,答曰:「张将军绑一人在县前痛打。」玄德忙去观看,见绑缚者乃督邮也。玄德惊问其故。飞曰:「此等害民贼,不打死等甚!」督邮告曰:「玄德公救我性命!」玄德终是仁慈的人,急喝张飞住手。</p>
<p>且说灵帝时,何进起身屠家;因妹入宫为贵人,生皇子辩,遂立为皇后,进由是得权重任。中平六年夏四月,灵帝病笃,召大将军何进入宫,商议后事。</p>
</body>
</html>
'@
New-EpubEntry $zip 'OEBPS/chapter3.xhtml' @'
<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>第三回 议温明董卓叱丁原</title></head>
<body>
<h2>第三回 议温明董卓叱丁原 馈金珠李肃说吕布</h2>
<p>且说曹操当日对何进曰:「宦官之祸,古今皆有;但世主不当假之权宠,使至于此。若欲治罪,当除元恶,但付一狱吏足矣,何必纷纷召外兵乎?欲尽诛之,事必宣露。吾料其必败也。」何进怒曰:「孟德亦怀私意耶?」操退而言曰:「乱天下者,必进也。」</p>
<p>进乃暗差使命,赍密诏星夜往各镇去。前将军、斄乡侯、西凉刺史董卓,先为破黄巾无功,朝廷将治其罪,因贿赂十常侍幸免;后又结托朝贵,遂任显官,统西州大军二十万,常有不臣之心。是时得诏大喜,点起军马,陆续便行。</p>
<p>却说董卓欲杀丁原,为吕布所阻。李肃曰:「某与吕布同乡,知其勇而无谋,见利忘义。某凭三寸不烂之舌,说吕布拱手来降,可乎?」卓大喜,观其人,乃虎贲中郎将李肃也。</p>
<p>李肃赍了礼物,投吕布寨来。伏路军人围住。肃曰:「可速报吕将军,有故人来见。」军人报知,布命入见。肃见布曰:「贤弟别来无恙!」布揖曰:「久不相见,今居何处?」肃曰:「现任虎贲中郎将之职。闻贤弟匡扶社稷,不胜之喜。」</p>
</body>
</html>
'@

$zip.Dispose()
$fs.Dispose()
Write-Host "测试书已生成: $out"
