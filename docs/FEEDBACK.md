# Palaute ja työjärjestys

Katselmointikommentit sellaisina kuin ne annettiin, ja mitä niille on tehty.
Tämä tiedosto on olemassa siksi, että kolme kohtausta korjataan yksi kerrallaan
ja kahden viimeisen kommentit pitää säilyttää sanatarkasti siihen asti kun ne
otetaan työn alle — muistinvarainen tiivistelmä ei kelpaa, koska juuri ne
yksityiskohdat jotka tiivistyvät pois ovat ne jotka kertovat mikä oli vialla.

Sovittu järjestys: **S9 → S7 → S11.** Yksi kerrallaan, kukin loppuun asti.

---

## S9 — Dark  ✅ tehty

> "Osa hahmoista on S9 rikkonaisia. Ja hahmot voisi piirtää niin että päät ja
> kädet ovat kiinni toisissaan. Ja myös jalanterät. Tässä mallihenkilö. Voisi
> olla eri asennoissa olevia henkilöitä. Ja höysteenä voisi silmät vilkkua. Ja
> sit ihan scenen lopussa silmät valaisevat kaiken ja tilanne ylivalottuu."

Mitä tehtiin:

* **Hahmo on nyt yksi yhtenäinen kappale.** Vanha siluetti oli neljä toisistaan
  riippumatonta suorakaidetta (vartalo, jalat, kädet, pää) yhdistettynä
  `max()`-operaatiolla, eikä sitä saa pysymään kasassa: käsivarsi piirrettiin
  0.128 päähän keskilinjasta kun hartiat ylsivät vain 0.115:een, joten jokainen
  käsi koko joukossa oli erillinen suorakaide vartalon vieressä. Tilalla on
  nivelistä koostuva etäisyyskenttä (`figureDist`): pää–kaula–rinta–lantio–
  reisi–sääri–nilkka–varvas on yksi ketju, ja kädet lähtevät samasta rinnasta.
  Vierekkäiset jäsenet jakavat nivelen, joten hahmo ei *voi* hajota missään
  asennossa.
* **Jalanterät** ovat mukana (nilkasta varpaisiin oma kapseli).
* **Asennot** vaihtelevat: kummankin käden kulma arvotaan erikseen, joka
  yhdeksännellä on käsi ylhäällä, haara-asento ja ylävartalon kallistus
  vaihtelevat. Kaikki hahmon indeksin puhtaita funktioita.
* **Silmät räpsyvät.** Jokaisella oma jakso (2.4–6.6 s) ja oma vaihe, ei
  synkronoitu mihinkään — tahdissa räpyttelevä joukko olisi kone. Räpäytys on
  55 ms kiinni ja 115 ms auki, ja se on `(t, seed)`:n puhdas funktio: ei
  laskureita.
* **Lopun ylivalottuminen.** Viimeiset ~1.6 s: silmät lakkaavat olemasta
  pisteitä jonkun toisen strobossa ja muuttuvat valonlähteeksi, vartalot
  valaistuvat punaisiksi edestä, ja kuva menee yli. Käyrä on kuutiollinen, eli
  mitään ei tapahdu ennen viimeistä puolta sekuntia.
* Kaksi bugia matkan varrelta, molemmat korjattu: hahmot piirrettiin
  hash-järjestyksessä, jolloin jokaisen ympärille jäi musta ääriviiva (yhden
  `InstancedMesh`in instansseja three ei lajittele — ja koska tässä maailmassa
  mikään ei liiku, oikea järjestys on vakio ja lasketaan kerran); ja
  loppuvälähdyksessä silmät erkanivat toisistaan sarviksi, koska quadin
  kasvatus siirsi myös silmien paikkoja.

### Toinen kierros: liikaa staattisuutta

> "Muuten on hyvä, mutta nyt on liian staattista. Eli hahmojen silmät voisivat
> räpsyä scenen aikana vähän eri tahdissa. Ja silmät voisivat myös liikkua
> niinkuin hahmot katselisivat vähän eri suuntiin. Ja myös kun kamerakulma
> vaihtuu niin hahmot voisivat horisontin suhteessa vähän liikkua immersiivisesti
> (eli takarivi liikkuu vähän eri tahtiin kuin eturivi)."

* **Räpytystahti** vaihtelee enemmän (jakso 1.7–5.3 s hahmoa kohti) ja kiihtyy
  kohtauksen edetessä. Loppupuolella silmät ovat suurin osa siitä mitä ruudussa
  on, joten kohtauksen oma kiihtyminen kuuluu tänne.
* **Katse liikkuu.** Kumpikin silmä saa saman siirtymän — ne ovat yhden pään
  silmät — ja katse pysyy suunnassa sekunnin tai pari ja siirtyy sitten uuteen
  noin kymmenesosasekunnissa. Tasainen liuku olisi näyttänyt siltä että koko
  joukko skannaa yhtä aikaa, eli valonheittimeltä; askel-ja-pito näyttää
  kahdeltasadalta ihmiseltä joilla kullakin on oma katsottavansa.
* **Kamera ajelehtii** — ja tämä on se kohta jossa ensimmäinen versio oli
  väärässä tavalla joka kannattaa kirjata ylös. Zoomi ei ole liike:
  kuvakulman kaventaminen skaalaa koko ruudun samalla kertoimella, joten etu- ja
  takarivi kasvavat yhdessä eikä syvyyttä synny. Parallaksi syntyy vain kameran
  paikan muutoksesta. Nyt kamera liikkuu noin metrin sivusuunnassa ja seitsemän
  eteenpäin koko kohtauksen aikana, katse lukittuna kiinteään pisteeseen 190
  yksikön päähän: takarivi pysyy paikallaan ruudussa (~9 px) ja eturivi liukuu
  sen yli (~126 px). Eteenpäin ryömintä tekee suuremman osan työstä kuin
  sivuliike, koska se muuttaa rivien kokosuhdetta.

### Kolmas kierros: räpsytys ei toimi, silmät kiinni parallaksiin

> "Räpsytys ei toimi. Eli luonnollinen räpsytys on että silmät ovat auki ja sit
> luomet menee kiinni hetkeksi ja sit auki (räpsäytys on aika nopea). Silmien
> liikutus voisi kans olla kytketty parallaxiin. Ja voisi heti alussa olla pientä
> liikettä kamerassa joka triggeröi silmien liikettä. Ja tarkista että liike menee
> niin että silmät eivät mene pään ulkopuolelle (jos silmä menee ulkopuolelle,
> niin se voisi lukittua pään siihen laitaan mistä olisi menossa ulos)."

Räpsytys oli rikki kahdesta syystä, ja molemmat kannattaa kirjata:

1. **Muoto oli kolmio, ei kolmivaiheinen.** Luomi meni kiinni 55 ms:ssä ja heti
   takaisin auki 115 ms:ssä, eli täysin kiinni se oli täsmälleen yhden
   ajanhetken. Kuudellakymmenellä ruudulla sekunnissa se on luomi joka ei ole
   alhaalla yhdessäkään renderöidyssä ruudussa: silmä himmenee ja kirkastuu
   eikä mikään mene kiinni. Oikea muoto on kolme vaihetta — **kiinni, pito,
   auki** — ja juuri pitovaihe on se jonka silmä lukee. Nyt 40 ms alas, 60 ms
   pidossa, 90 ms takaisin.
2. **Kiinni oleva luomi jätti kirkkaan viivan.** Pelkkä pystysuuntainen litistys
   jättää ohuen hehkuvan juovan, joka bloomin kanssa ei juuri eroa auki olevasta
   silmästä. Luomi on läpinäkymätön: alle viidesosan auki olevasta silmästä ei
   näy mitään.

Lisäksi löytyi kolmas, hiljaisempi bugi: räpytystaajuutta nostettiin jakamalla
jakso kiihtyvällä kertoimella. Kun jakso itse liikkuu, vaihe etenee nopeudella
`1/P − t·P'/P²`, ja kun `t` on 140 sekunnin luokkaa, tuo jälkimmäinen termi on
viisinkertainen ensimmäiseen nähden — eli räpytystiheyden määräsi biisin
absoluuttinen kello eikä mikään tässä kohtauksessa. Korjaus: shaderille
annetaan kertymä (`uClock`, kiihtyvyyden integraali suljetussa muodossa) eikä
jaettua jaksoa.

* **Katse on kytketty parallaksiin** kahdella termillä. `vLook` on geometriaa:
  vertex-shader laskee missä kamera on kunkin pään omassa koordinaatistossa,
  joten se muuttuu kameran ajelehtiessa — paljon eturivillä, tuskin lainkaan
  takarivillä. Silmät poimivat siis saman parallaksin samassa suhteessa kuin
  vartalotkin. `uTrack` on kameran **nopeus**, jaettuna koko joukolle: pää ei
  vain tiedä missä olet, vaan huomaa sinun liikkuvan, ja huomaa sen yhtä aikaa.
* **Alun nykäisy** on vaimeneva heilahdus kohtauksen ensimmäisen puolentoista
  sekunnin aikana. Sen tehtävä ei oikeastaan ole liikuttaa kameraa — puoli
  yksikköä ei ole liike — vaan olla ensimmäinen asia joka tapahtuu: 260 silmäparia
  vilkaisee samalla hetkellä. Se on ainoa hetki tässä maailmassa jolloin kaikki
  toimivat yhdessä.
* **Silmä ei mene pään ulkopuolelle.** Kolme riippumatonta termiä lasketaan
  yhteen, joten mitään amplitudia ei voi virittää niin että summa olisi
  varmasti pieni; sen sijaan summa rajoitetaan päähän. Rajoitus on
  **säteittäinen ja tehdään ulommalle silmälle** (se joka lähtisi ensin), joten
  reunan yli menevä silmä liukuu pitkin reunaa sen sijaan että pysähtyisi
  seinään — juuri kuten pyydettiin. Tarkistettu 400 000 satunnaisotoksella koko
  yhdistetyltä liikealueelta: uloin silmän reuna yltää 0.4265:een kun pään säde
  on 0.4545.

### Neljäs kierros: päällekkäiset hahmot ja liikkeen jatkuminen

> "Nyt on tosi hyvä. Ihan muutama hahmo on vain päällekkäin niin että silmät ja
> hahmot sekoittuvat. Ne voisi selkeyttää. Ja alussa liike alkaa hyvin mutta
> pysähtyy paikalleen. Eli voitaisiin pannata vasemmalta oikealle ja takaisin
> vasemmalle ja sen jälkeen ympyrän kaaressa oikealle ja sit loppu kuten se on
> zoomaten."

**Päällekkäisyys.** Joukko rakennetaan nyt kameran koko reittiä vasten: hahmo
hylätään jos sen pää menisi päällekkäin jonkin jo pystyssä olevan pään kanssa
*missä tahansa* kohdassa reittiä (yhdeksän näytettä). Ensimmäinen yritys
sovelsi sääntöä jokaiseen pariin, ja se oli väärin tavalla joka kannattaa
kirjata: lähipään näennäissäde on kymmenkertainen kaukaiseen nähden, joten
pelkkänä kulmana kirjoitettu sääntö antaa eturivin hylätä suurimman osan
takanaan olevasta tasangosta. Kolmannes joukosta karsiutui ja tilalle tuli
kuorolinja — tasavälein aseteltuja, lähes samankokoisia hahmoja rivissä.
Jakauma, josta joukko rakennetaan, ei ole optimoitava asia; se *on* se joukko.

Sääntö on siis rajattu siihen tapaukseen joka oikeasti näyttää väärältä: kaksi
päätä jotka **molemmat** ovat tarpeeksi isoja luettaviksi päiksi, päällekkäin.
Kaukainen pää lähemmän takana ei ole ongelma eikä ole koskaan ollut, koska
lähempi kirjoittaa syvyyden ja peittää sen. Rajana 0.009 radiaania eli noin 30
pikselin pää — se koko jossa kaksi silmää lakkaa olemasta yksi piste. Näillä
luvuilla 11 hahmoa 260:stä hylätään ja loput joukosta on täsmälleen entisensä.

**Liike.** Neljä kahden tahdin liikettä, kukin alkaa iskulle:

| tahdit | liike |
|---|---|
| 80–82 | panorointi vasemmalta oikealle |
| 82–84 | panorointi takaisin vasemmalle |
| 84–86 | kaari oikealle (ja linssi alkaa kaventua) |
| 86–88 | kaari hiipuu zoomin alla |

Panoroinnit on kirjoitettu kosineina eikä pehmennettyinä rampeina: kosini on jo
täydessä vauhdissa liikkeen puolivälissä ja hidastuu vain käännöksessä, mikä on
juuri se mitä panorointi tekee. Pehmennetty ramppi pysähtyisi kuoliaaksi
jokaisessa saumassa — eli tekisi juuri sen mistä palaute tuli.

Panoroinnin mukana kulkee pieni sivuttaisajo. Pelkkä panorointi on kierto, ja
kierto siirtää koko kuvaa saman verran: etu- ja takarivi lakaisevat yhdessä ja
kuva on yhtä litteä kuin zoomin aikana. Panorointi ja ajo yhtä aikaa on se mikä
tekee lakaisusta syvän.

Kaari kiertää 0.030 rad keskipisteen ympäri 175 yksikön päässä, katse lukittuna
siihen keskipisteeseen — takarivi pysyy paikallaan ruudussa ja eturivi matkaa
sen yli. Kaari jatkuu vielä kolmanneksen verran viimeisten kahden tahdin
aikana, jotta kuva ei saavu paikalleen juuri kun zoomi ottaa vallan. Kaiken
alla on pieni huojunta (neljännesyksikkö) taajuuksilla joilla ei ole yhteistä
tekijää muiden kanssa: sen ainoa tehtävä on ettei mikään osa tätä kohtausta ole
koskaan täysin paikallaan, ei myöskään liikkeiden välissä.

### Viides kierros: silmät ulos päästä

> "Vielä muutamilla hahmoilla silmät meni ulos päästä. Vois koittaa lukita että
> silmät ei pääse menemään pään reunojen ulkopuolelle."

Kaksi syytä, ja ensimmäinen oli oikea vika:

1. **Silmätaso työnnettiin väärään suuntaan.** Silmät piirretään omalle
   neliölleen, jonka täytyy olla hitusen vartalotason edessä tai syvyystesti
   heittää sen pois. Työntö tehtiin *hahmon oman katsesuunnan* mukaan, yli
   puolen pään säteen verran. Kameraa kohti katsovalla hahmolla se on suoraan
   linssiä kohti ja näkymätön; viisikymmentä astetta kääntyneellä se on
   enimmäkseen **sivuttain**, ja liu'utti silmäneliön pois päästä jolle se
   kuului. Juuri se selittää "muutamilla hahmoilla": ne olivat ne runsaat
   kaksikymmentä prosenttia joilla on iso kääntymä. Nyt työntö tehdään
   katsesäteen suuntaan — hahmosta kameraa kohti — jolloin sillä ei ole
   sivuttaiskomponenttia lainkaan, rakenteeltaan.
2. **Rajoitus piti keskipisteen sisällä, ei silmää.** Ytimellä on oma säteensä
   ja hehkulla paljon isompi, joten reunalle pysäköity mustuainen jättää valoa
   siluetin ulkopuolelle.

Toinen on nyt korjattu maskilla eikä lupauksella: pää on tunnetun säteinen
kiekko tämän neliön keskellä, joten kaikki mitä silmä piirtää kerrotaan sillä
kiekolla eikä mikään voi olla sen ulkopuolella, tekivätpä yllä olevat termit
mitä tahansa. Rajoitus on silti tallella — se on se joka saa silmän **liukumaan
reunaa pitkin** sen sijaan että se leikkautuisi siihen — mutta maski on se joka
tekee säännöstä tosen. Loppuvälähdyksessä maski vapautetaan, koska siinä valon
kuuluukin lähteä päästä.

### Kuudes kierros: litistyneet hahmot reunoilla

> "Nyt oli silmät hyvät. Osa hahmoista oli liian kapeita ainakin oikealla ja
> ihan vasemmalla. Niinkuin olisivat litistyneitä."

Hahmojen kääntymä oli tallennettu **maailman suuntana**, ei kameraan nähden.
Neliön normaali osoitti siis maailman +z-akselille, aivan kuin kamera olisi
suoraan jokaisen hahmon edessä. Se ei ole: ruudun reunalla oleva hahmo nähdään
kolmenkymmenen asteen kulmasta, ja joukon oma sektori ulottuu 54 asteeseen.
Kun siihen lisätään hahmon oma kääntymä, katsesäteen ja neliön välinen kulma
ylittää kahdeksankymmentä astetta — ja sen kosini on seitsemäsosa, eli hahmo
piirtyy seitsemäsosan leveänä. Juuri siksi vika näkyi *reunoilla*: siellä
kulma on suurin. Mitään vikaa noissa hahmoissa ei ollut, niitä katsottiin
kulmasta jota kukaan ei ollut valinnut.

Nyt neliö suunnataan ensin kameraan ja hahmon oma kääntymä lisätään siihen,
jolloin kääntymä tarkoittaa samaa kaikkialla ruudussa: kolmenkymmenen asteen
verran kääntynyt hahmo piirtyy kolmenkymmenen asteen verran kääntyneenä
seisoipa se kuvan keskellä tai laidassa. Kamera liikkuu muutaman yksikön ja
hahmot ovat kymmenien tai satojen päässä, joten yksi tässä laskettu suuntima —
reitin keskeltä — pätee koko kuvalle astetta tarkemmin.

Mitattuna: ruudulla näkyvän hahmon pahin vaakalitistys oli 29 % leveydestä,
nyt 81 %. Loppu 19 % on hahmon oma kääntymä, eli sen kuuluukin näkyä.

### Seitsemäs kierros: lopun sisääntulo isommaksi

> "Lopussa oleva sisään liike voisi olla vähän suurempi."

Linssi kaventuu nyt 46 asteesta 28:aan aiemman 31:n sijaan, mutta suurempi
muutos on että viimeisten kahden tahdin alle on lisätty oikea yhdeksän yksikön
ajo eteenpäin. Eksponentiaalinen ajo, joka kantaa kohtauksen alkupuolen, on
siihen mennessä lähes pysähtynyt — se on suunniteltu pysähtymään, jottei se ja
linssi kiihdytä yhtä aikaa — joten ilman tätä lopun ainoa liike olisi zoomi.
Zoomi ei ole liike: se skaalaa koko ruudun yhdellä luvulla eikä joukko saavu
yhtään lähemmäs kuin rajaus toisi sen.

Yhdeksän yksikköä kolmessa sekunnissa tuo lähimmän kuvassa näkyvän hahmon
36 yksiköstä 27:ään — kolmanneksen isommaksi — kun joukon takaosa kasvaa
kolme prosenttia. Juuri se ero on se osa jota linssi ei osaa tehdä.

---

## S7 — Volcanic  🔄 ensimmäinen kierros tehty

> "S7 tulivuoret eivät näytä yhtään tulivuorilta. Eli ne pitää generoida vähän
> samaan tapaan kuin aavikko, eli että on realistinen tulivuorimaisema jossa
> tulivuoren huipulta valuu laavaa. Nyt suunta ei ole oikea."

Suunta on siis vaihdettava, ei viritettävä. Nykyinen toteutus rakentaa seitsemän
erillistä `ConeGeometry`-kartiota tasaisen maan päälle; palaute sanoo että
maiseman pitää syntyä korkeuskenttänä samaan tapaan kuin `env/desert.js`:n
dyynit, ja laavan pitää valua huipulta alas. Kartiot kannattaa todennäköisesti
hylätä kokonaan.

### Mitä tehtiin

Kartiot on poistettu kokonaan ja maa on nyt **yksi korkeuskenttä**, jossa
tulivuoret ovat paikkoja eivätkä esineitä. Se on koko juttu, eikä se ole
yksityiskohtakysymys: tasangolla *seisova* kartio on objekti — sillä on
ääriviiva, jalusta jossa se kohtaa maan, ja koko, eli kaikki mitä brief
kieltää. Tulivuori ei ole maisemassa oleva esine vaan maiseman oma muoto:
tasanko ei lopu siihen mistä vuori alkaa, se kallistuu ja jatkuu. Vain
korkeuskenttä voi sanoa niin, koska vain sillä on yksi pinta.

* **Profiili** on `pow(1 - u, 1.55)`, ja juuri se ratkaisee näyttääkö tämä
  tulivuorelta vai juhlahatulta. Suoraseinäisellä kartiolla on vakiokaltevuus
  ja se näyttää valmistetulta; oikea stratovulkaani on **kovera** — hyvin jyrkkä
  heti kraatterin alla ja loiveneva koko matkan kunnes se kohtaa tasangon
  ilman kulmaa lainkaan. Ykköstä suurempi eksponentti antaa täsmälleen tuon, ja
  antaa sen nollagradientilla kohdassa u = 1, joten vuori ei lopu mihinkään.
* **Kraatteri**: huippu litistetään reunan korkeuteen ja siihen kaivetaan malja,
  koska tulivuoren korkein kohta on rengas eikä piikki.
* **Uomat** ovat säteittäisiä, koska alamäki kartiolla on säteittäinen. Ne
  näytteistetään kohinana **ympyrällä** — fbm pisteessä (cos a, sin a)·k —
  eikä kulman kohinana, joka repeäisi ±π:ssä.
* **Laava** valuu kraatterista niitä uomia pitkin, kapeana ja säikeisenä,
  jäähtyen eksponentiaalisesti: valkoinen aukolla, oranssi puolivälissä,
  tummanpunainen alhaalla. Kuori ajelehtii alamäkeen — se on ainoa asia tässä
  maailmassa joka liikkuu olematta hiukkanen, ja se liikuttaa valoa eikä
  geometriaa. Pinta itse on puhdas paikan funktio.
* **Kamera seuraa maastoa.** Kuudensadan metrin korkeusvaihtelu ja 34 yksikön
  lentokorkeus tarkoittaisi loppukuvan viettämistä rinteen sisällä. Korkeus
  luetaan CPU-peilistä samasta kentästä jota vertex-shader siirtää — samanlainen
  mutta eri funktio asettaisi kameran luottavaisesti pinnan alle.
* Savupatsaat nousevat nyt kraattereista, samasta taulukosta luettuna.

Neljä virhettä matkan varrelta, kaikki kirjattu koodiin:

1. **Etualan halkeamat paloivat puhki.** `crackGlow` palauttaa 1.6 siellä missä
   joki ylittää elävän alueen, ja sauman ydin oli tuo **kuutioituna** — 4.1×.
   Maski on murtoluku, ei vahvistus.
2. **Valo ylhäältä tappoi muodon.** Ensimmäinen versio valaisi laajalla lähteellä
   suoraan ylhäältä (fysikaalisesti puolustettavaa: valaistu tuhkakatto on juuri
   sellainen) ja koko maasto näytti sileältä. Suoraan ylhäältä valaistulla
   maisemalla ei ole muotoa: jokainen ylöspäin osoittava pinta saa saman valon
   kaltevuudesta riippumatta. Reliefi näkyy vain kun valo on **matalalla** — ja
   rehellinen lähde on matalalla joka tapauksessa, koska tämän maailman
   kirkkain kohta on horisontin yläpuolinen vyö jossa sula maa sirottaa omaa
   valoaan takaisin tuhkan läpi.
3. **Laavavirrat lipsuivat poikittain.** Uoman vaellus oli 0.62 radiaania, mikä
   siirsi kanavan tuhannen yksikön päässä aukosta kuusisataa yksikköä sivuun
   matkalla alas — virrat piirtyivät korkeuskäyrien suuntaisiksi tahroiksi.
   Alamäki kartiolla on säteittäinen; kanava saa mutkitella sen ympärillä, ei
   ylittää sitä.
4. **Kohinatöyssy ilman etäisyyshäivytystä** muuttui koko tasangon yli ryömiväksi
   hiekkapaperiksi, ja sen hienompi oktaavi oli 13 metriä eli ensimmäinen asia
   tässä maailmassa jolla oli nimettävä koko.

Avoinna: kolmiomainen shakkilautakuvio ei enää koske S7:ää (kartiomeshit ovat
poissa).

### Toinen kierros: kiertoliike, kirkkaampi alku, lisää laavaa ja savua

> "Alku oli vähän hämärä, mutta loppua kohti parani. Alkuun voisi kokeilla että
> liikutaan vasemmalta oikealle niin että kierretään tulivuorta. Ja sit loppuun
> se juoksu eteenpäin. Ja ehkä ainoa mitä jäin kaipaamaan on laavavirtoja ja
> savua joka nousisi tulivuorista."

**Liike on nyt kaksi osaa, jotka ovat yksi käyrä.** Tahdit 70–72 kiertävät
päätulivuorta vasemmalta oikealle, katse lukittuna siihen; tahdista 73 kamera
irrottaa otteensa ja juoksee. Kierto on ainoa liike joka sanoo "tämä on yksi
valtava esine" näyttämättä koskaan sen jalustaa jotain vasten: ohiajo antaa
parallaksin, mutta vain kierto pitää saman asian kuvassa samalla kun kaikki sen
takana vaihtuu — ja juuri se saa silmän lukemaan kohteen kiintopisteeksi ja
maailman sen ympäri kääntyväksi.

Liitos on ilmainen, ja siksi se rakennettiin näin: kierron lopussa kamera on jo
matkalla ympyrän **tangenttia** pitkin, joten juoksu on vain se tangentti
jatkettuna. Ei uudelleensijoitusta, ei suunnanmuutosta, ei mitään pehmennettävää
— kuva irtoaa vuoresta täsmälleen niin kuin sitä kiertänyt irtoaisi. Nopeus on
kaarenpituutta eikä kulmaa, joten sama suljettu ramppi kelpaa molemmille, ja
kierron kulma **johdetaan** siitä (kaarenpituus jaettuna säteellä) eikä valita
— nopeuden muuttaminen ei voi jättää kameraa puoliväliin.

**Alku on nyt kohtauksen kirkkain osa**, mikä kääntää aiemman päätöksen ympäri.
Perustelu matalalle valotukselle pätee yhä *juoksuun* — tämän maailman ainoa
valo on sen oma, ja valotuksen nostaminen kiven näkemiseksi tekee mustasta
taivaasta harmaan — mutta ensimmäinen kuva ei ole kuva kivestä vaan vuoresta
jolla on laavaa, omaa savupatsastaan vasten.

**Laavaa on enemmän:** eläviä uomia oli kaksi vuorta kohti, mikä on levossa
oleva tulivuori; nyt neljä tai viisi, mikä on purkaus. Myös tasangon leveät
virrat palautettiin — ne oli leikattu pois samalla kun etualan puhkipalaminen
korjattiin, vaikka syy siihen oli sauman ytimen kuutiointi eikä virrat, ja
juoksu jäi ylittämään tyhjää lattiaa.

**Savu nousee laavasta**, ei hashista. Kraatterista lähtee patsas ja kummankin
elävän virran päälle nousee höyry — ja virtojen paikat luetaan CPU:lla samasta
kentästä jolla fragmentti ne piirtää. Kylmällä kivellä hehkuvan uoman vieressä
seisova patsas on se merkki josta näkee että kaksi asiaa on generoitu eri
koodilla, ja tässä maailmassa on täsmälleen kaksi kirkasta asiaa — kukaan ei
jättäisi sitä huomaamatta.

Kaksi virhettä lisää matkalta:

* **Tähtäin oli vuoren korkeuden verran liian ylhäällä.** `terrainHeightAt()`
  vuoren keskellä on jo *kraatterin pohja* — se sisältää koko vuoren — ja siihen
  lisättiin vielä 0.95 kertaa kartion korkeus. Kamera tähtäsi toista vuorta
  ensimmäisen yläpuolelle: 24 astetta ylös, ja kierretty tulivuori istui muuten
  tyhjän kuvan alareunassa.
* **Maa häivytettiin kiinteään usvaväriin**, joka on eri väri kuin taivas sen
  yläpuolella — koko horisontin mittainen kova vaakaraita. Sama vika jonka
  aavikko sai ja sama korjaus: maan on häivyttävä siihen taivaaseen joka
  **oikeasti** on sen pikselin takana, joten molemmat kutsuvat nyt samaa
  funktiota.

### Kolmas kierros: laavan puoli, liike laavaan, savut kärkiin

> "Alku oli nyt huonompi. Pidetään vaan kuvakulma siinä puolella tulivuoria
> joissa on laavaa. Loppu oli muuten hyvä, mutta sukellettiin vuoren sisään.
> Saisitko laavaan liikettä, ja kohdistettua savut tulemaan tulivuorten
> kärjistä?"

**Kuvakulma laavan puolelle** ratkaistiin kääntämällä kysymys ympäri: sen
sijaan että kameraa siirrettäisiin laavan luo, laava siirrettiin kameran
puolelle. Vuoren siemenluku ei ole koriste — se päättää *missä kohtaa vuorta*
elävät uomat ovat — ja kamera katsoo sitä viisi sekuntia yhdestä suunnasta.
Kameran suuntima päävuoresta kulkee kierron aikana 0.00:sta 0.41 radiaaniin,
ja siemen 0.547 valittiin **mittaamalla**: se on se, jonka kanavat ovat
vahvimmat täsmälleen tuolla välillä.

**Laavavirrat eivät enää lopu vuoren juureen.** Katkaistuna kohdassa u = 1
jokainen virta päättyi siistiin ympyrään oman kartionsa juurella, ja tasanko
vuorten välissä — eli juuri se missä toinen kuva viettää koko juoksunsa — jäi
tyhjäksi. Kenttä ulottuu nyt 1.9:ään asti, korkeustermit lakkaavat 1.0:ssa, ja
kanava **levenee** juuren jälkeen, koska virta jolla ei ole uomaa pitelemässä
tekee niin. Se vaati korkeusfunktion jakamista kahtia: vertex-vaihe käyttää
halpaa `coneH`:ta joka poistuu kohdassa u = 1, fragmenttivaihe täyttä
`coneAt`:ia joka jatkaa 1.9:ään.

**Laavassa on liikettä.** Kaksi vyöhykettä yhden sijaan: hieno kuoriokuvio joka
ajelehtii nopeasti ja pitkä aalto joka liikkuu sen alla kolmasosanopeudella —
juuri sitä miltä minkä tahansa aineen virta näyttää, pintakuvio kulkee
nopeammin kuin runko jolla se on. Ja kontrasti on paljon suurempi kuin
ensimmäisen version 0.45–1.30: kolmanneksen verran kirkastuva ja himmenevä
laava on valaistu raita jossa on välkyntä, kun taas liikkeen tekee **tumman
kuoren kulkeminen kirkkaan sulan yli** — ja siihen tumman on oltava oikeasti
tummaa. Mitattu: 0.1 sekunnin välein renderöidyissä ruuduissa kuorivyöt
siirtyvät näkyvästi alamäkeen.

**Savut kärjistä.** Patsaan tyviLEVEYS on se joka kertoo mistä se tulee, ja
210 yksikössä ensimmäinen puffi oli kaksi kertaa leveämpi kuin kraatteri josta
sen piti nousta — savu luki koko huipulta nousevaksi. Nyt tyvi on 88–122, eli
kraatterin sisällä jokaisella taulukon vuorella, ja patsas avautuu
neljätoistakertaiseksi noustessaan. Puffien pystyjako on neliöllinen eikä
1.25-potenssi, joten ne pakkautuvat vention yläpuolelle ja venyvät ylhäällä;
1.25:llä ensimmäiset olivat 170 yksikön päässä toisistaan ja 90 leveitä, eli
kraatterista nouseva pisteviiva. Rinteiden höyrypatsaat poistettiin: ne
seisoivat siellä missä laava oli, mikä oli perusteltua, mutta etäältä toinen
patsas puolivälissä rinnettä lukee toisena huippuna — ja tällä kohtauksella on
yksi ohje mittakaavasta.

**Vuoren sisään sukeltaminen** oli mittausten mukaan näköharha: kamera on koko
juoksun ajan 95–260 yksikköä maanpinnan yläpuolella, eikä koskaan sen alla.
Mutta juoksu päättyi *edessä olevan vuoren jalkaan* — kameran ollessa sen oman
jalanjäljen sisällä rinne täytti kuvan alaosan tekstuurittomana seinänä. Vuori
siirrettiin 600 yksikköä kauemmas: juoksu päättyy 370 yksikköä sen juuresta,
eli lähestyen eikä saapuen.

### Neljäs kierros: savu oli kaksiulotteinen — oikea bugi

> "Nyt jos keskitytään aitoihin bugeihin. Ekan tulivuoren savu on
> kaksiulotteinen."

Se oli sitä kirjaimellisesti. Savupuffit piirrettiin muuntamalla tason omat
kärkipisteet instanssimatriisin läpi, ja se matriisi koostettiin
**yksikkökierrolla** eikä siihen sen jälkeen koskettu. Jokainen puffi jokaisessa
patsaassa oli siis litteä neliö maailman XY-tasossa, kasvot maailman +z:aan,
koko elokuvan ajan.

Se näytti oikealta niin kauan kuin tämän kohtauksen kamera katsoi vain −z:aan —
ja lakkasi näyttämästä sinä hetkenä kun ensimmäisestä kuvasta tuli kierto.
Sivulta katsottuna patsas on pahvinpala kyljittäin.

Korjaus on rakentaa neliö **näkymäavaruudessa**, ja se on sama jota
`buildEmbers()` on käyttänyt alusta asti: instanssin keskipiste model-view
-matriisin läpi, sitten siirtymä näkymäkehyksen x:ssä ja y:ssä, jolloin neliö on
suorassa linssiin nähden riippumatta siitä missä linssi on. Ei
instanssikohtaista billboard-matriisia, ei mitään päivitettävää joka ruudulle,
ei mitään joka voi vanhentua. Instanssimatriisi kantaa yhä puffin paikan ja
leveyden; vain sen (koskaan asettamaton) kierto jätetään nyt huomiotta
tarkoituksella eikä vahingossa.

Tarkistin samalla muut instansoidut billboardit: `env/jungle.js`:n liekit
suunnataan kameraan CPU:lla joka ruudulla (toimii), `env/tunnel.js`:n ja
`env/islands.js`:n instanssit ovat oikeaa geometriaa eivätkä billboardeja, ja
`env/dark.js`:n hahmot ovat kiinteän kierron tasoja tarkoituksella. Tämä oli
ainoa.

---

## S11 — Islands  🔄 ensimmäinen kierros tehty

> "S11 kivi ja kasvillisuus. Samaten tämä ei ole mennyt parempaan suuntaan. Sama
> perusongelma kuin tulivuorissa, ei näytä yhtään. Kannattaa hakea koko objektia
> joka on generoitu kivi. Ja maisemassa voisi olla useampia eri kokoisia
> objekteja, joissa objektin päällä on kasvillisuutta, metsää, vesiputousta,
> yms."

Sama perusongelma kuin S7:ssä ja sama johtopäätös: tavoitteena on **generoitu
kiviobjekti**, ei kartio jonka kylkeen on lisätty yksityiskohtia. Maisemaan
useita eri kokoisia lohkareita, joiden päällä kasvillisuus, metsä ja
vesiputoukset.

### Mitä tehtiin

**Shakkilautakuvio oli oikea bugi, ja syy ei ollut normaaleissa.** Vanhat
muistiinpanot syyttivät niitä ja lopulta "attribuuttiputkitusta"; kumpikaan ei
ollut se. Siirtymä rakennettiin termeistä kuten `sin(x*y*2.7)` — kahden
koordinaatin **tulosta**, jonka paikkataajuus kasvaa rajatta kun origosta
siirrytään. Parin yksikön päässä kenttä värähtelee nopeammin kuin verkko ehtii
näytteistää, joten naapurikärjet saavat käytännössä toisiinsa liittymättömät
siirtymät, kolmiot taittuvat toistensa läpi ja `computeVertexNormals()`
raportoi sotkun uskollisesti. Se on sama alinäytteistysansa jonka tämä projekti
on nyt kohdannut neljässä ympäristössä — naamioituneimmassa muodossaan: kenttä
ei ollut vain liian hieno, sillä ei ollut mittakaavaa lainkaan.

**Kivi on nyt oikeasti generoitu kivi.** Pohjana aliejaettu ikosaedri
kartion sijaan: tasakokoisia kolmioita, ei napoja, ei saumaa, ja **indeksoitu**
— three'n oma `IcosahedronGeometry` ei ole, jolloin `computeVertexNormals()`
antaa tahkonormaalit eikä pehmeitä. Muoto:

* **Pohjakaavan ääriviiva** näytteistetään kohinana ympyrällä, joten se kiertää
  ilman saumaa — tämä yksin estää suurimman osan pyörähdyskappaleen vaikutelmasta.
* **Profiili**: matala eksponentti termissä (1 − y²) muuttaa pallon yläosan
  **tasanteeksi jolla on terävä reuna** kupolin sijaan; alapuoli saa korkean
  eksponentin ja kuristuksen, eli kölin.
* **Kolme kohinatermiä**: iso möykky, harjanteinen alapuolelle (repeämä) ja
  hienompi harjanteinen pinnoille. Harjanteinen eikä pehmeä, koska
  harjanteisessa kentässä on taitteita ja pehmeässä vain kumpuja — se on ero
  kiven ja säkkituolin välillä.
* **Kerrospinnat** työnnetään kohti kanttiaaltoa potenssikäyrällä, jolloin
  jyrkänne **porrastuu** sen sijaan että se aaltoilisi.

Aliejaotus nostettiin neljästä viiteen, koska verkko asettaa katon sille kuinka
rosoinen kivi saa olla: nelosella särmä on yhdeksäsosa säteestä eikä mikään
lohkaretta terävämpi kelvannut.

**Metsä, kasvillisuus, vesiputoukset ja juuret seisovat kiven omilla
kärkipisteillä**, eivät kaavalla joka arvaa missä saari suunnilleen on. Saari
on ainoa joka tietää oman muotonsa, ja kaikki mikä sijoitetaan toisen mielipiteen
perusteella siitä, leijuu.

**Koot** kattavat kertaluokan (70–710 yksikköä), koska kenttä jossa jokainen
kivi on kaksinkertainen naapuriinsa nähden ei sisällä mittakaavaa lainkaan.
Sivuttaisetäisyys käytävästä **skaalautuu koon mukaan**: mitattuna kamera
lensi 355 yksikköä nollannen saaren *sisällä*, kun vakioetäisyys jäi voimaan
sen jälkeen kun saarista tuli seitsemänsataa yksikköä leveitä.

### Toinen kierros: vesiputoukset, kameraliike, juuret, ulkonemat

> "Suunta parempaan. Vesiputoukset eivät näytä vielä vesiputouksilta. Ja
> voitaisiin liikkua niin että ruudulla näkyy kappaleita, nyt S11 puolivälissä
> mennään vaan tyhjään avaruuteen. Hyvin voitaisiin tehdä niin että mennään
> yhden kappaleen 'juureen' ja sit käännetään kuvakulma ylöspäin ja mennään
> nopeasti reunan yli 'viidakkoon'. Kappaleiden alaosat voisivat olla pidempiä,
> ja 'juurimaisia' ja niissä voisi olla halkeampia joista tulee ulos puiden
> juuria. Ja myös voisi olla kappaleiden välillä pieniä kasvillisuutta
> sisältäviä kallion halkeamia/ulkonemia."

**Vesiputouksista puuttui säikeet.** Vanha oli yksi pehmeä nauha jonka päällä
kohinapesu, alaspäin haalistuen — eli valon suttu, ja sellaiselta se näytti.
Putoava vesi ei ole läpikuultava levy vaan joukko erillisiä lankoja lähekkäin,
ja silmä tunnistaa vesiputouksen niistä eikä juuri mistään muusta. Lisäksi
kolme asiaa joita vesi tekee: se lähtee reunalta **kapeana** ja leviää
pudotessaan, se putoaa **nopeammin alempana** (vakionopeuksinen vieritys lukee
painettuna kuviona jota raahataan ohi), ja se muuttuu sumuksi reunoiltaan.

Sen jälkeen putoukset piirtyivät **tikapuina**: `aDrop` on yksi arvo koko
neliölle, joten kaikki sillä ohjattu — leveys, häivytys, vierityksen nopeus —
porrastui joka segmentin rajalla, ja kaksikymmentä päällekkäistä neliötä joiden
alareuna häivytettiin nollaan piirsi suorakaiteiden pinon. Korjaus: jatkuva
pudotuskoordinaatti interpoloidaan neliön korkeuden yli, ja sivuttaisheilahdus
on sileä funktio eikä segmenttikohtainen hash.

**Kameraliike on nyt ankkuroitu kohteeseen.** Se selittää myös alkuperäisen
vian: vanha reitti oli kolme kaavaa maailmankoordinaateissa, joilla ei ollut
mitään yhteyttä siihen missä saaret olivat — puolivälissä kamera yksinkertaisesti
oli jossain muualla. Kohteeseen nähden kirjoitettu reitti ei voi tehdä niin. Nyt
liike kiertää yhtä saarta ja on kirjoitettu **sen omassa säteessä**: leveä
lähestyminen viiden säteen päästä, lasku reunan ohitse kalliota ja vettä pitkin
kölin alle, ja sitten katse ylös ja nousu kölin ulkopuolella kunnes ollaan
tasanteen yläpuolella — *ulkopuolella*, koska sisäpuoli on kiveä — ja vasta
sitten reunan yli metsään. Nousu ja ylitys ovat kaksi erillistä helpotusta
kolmannen kuvan sisällä, ja juuri se jako pitää kameran ulkona kappaleesta.

**Kölit ovat kaksi kolmasosaa pidempiä ja haarautuvat.** Kulmakenttä kuristaa
kiveä lohkojen välistä ja antaa lohkojen roikkua alemmas, joten alaosa laskeutuu
useana juurena eikä yhtenä porkkanana. Halkeamat ovat harjanteista kenttää
ympyrällä, ja ne ovat sekä geometriaa **että sijoituskanava**: juuret
poimitaan halkeamien kohdalta, joten fissuurasta ulos tuleva juuri tosiaan tuli
fissuurasta eikä hashista joka sattui osumaan sen lähelle.

**Pienet ulkonemat** ovat samaa kiveä samasta funktiosta karkeammalla
aliejaotuksella. Neljätoista saarta muuten tyhjässä tilavuudessa ei anna
silmälle mitään millä arvioida etäisyyttä — välit ovat samaa mustaa joka
etäisyydellä — ja sillä hetkellä kun kuvassa on jotain jonka koko tiedetään,
kaikki muu saa etäisyyden.

### Kolmas kierros: joki, nebula, ilmakehät, kiertävä kamera

> "Haluaisin vesiputoukset niin että siitä näkyy oikeasti valuvan vettä. Vesi
> valuu kappaleen yläosassa olevasta joesta. Ja vesiputous haihtuu alhaalla
> kaasuksi. Paneroi leijuvat kappaleet niin että taustalla näkyy muutkin
> kappaleet, nyt katsotaan vain yhtä. --- Ja ei näytetä alaosia. --- laita
> ilmakehäkupua kaikkiin kappaleisiin ja myös ilmakehästä heijastuu auringon
> valo. Ja vaihda revontuliefekti enemmän nebulamaiseksi taustaksi."

**Joki.** Vesiputous jonka yläpuolella ei ole mitään on raita joka alkaa
tyhjästä: silmä kysyy mistä vesi tulee eikä saa vastausta, eikä mikään määrä
työtä itse putoukseen tuota sellaista. Korjaus on ylävirrassa. Jokaisella
putouksella on nyt uoma joka juoksee sen luo tasanteen yli, kaukaa sisämaasta,
**maanpintaa pitkin** — korkeus näytteistetään saaren omista yläkärkipisteistä.
Ensimmäinen versio otti lähimmän pisteen ja piirsi portaikon, jolloin nauha oli
puolella askelmista maan yläpuolella ja puolella sen sisässä: joki
irrallisina valkoisina suorakaiteina. Kuuden lähimmän käänteisetäisyyspainotus
palauttaa sileän pinnan samoista pisteistä.

**Putous haihtuu kaasuksi.** Alla ei ole mitään mihin osua, joten putous ei
lopu — se lakkaa olemasta vettä. Sumu on kapea ja seuraa säikeitä; sen alla
oleva kaasu on kolme kertaa leveämpää, siinä ei ole säikeitä lainkaan ja se
kupruilee omalla paljon hitaammalla kellollaan. Ja säikeet **sammutetaan** kun
kaasu ottaa vallan: vesi joka on yhä lankoina pudotuksen pohjalla ei ole
haihtunut, se on vain häivytetty pois.

**Nebula** korvaa revontulet. Kaksi asiaa tekee siitä nebulan eikä värillistä
sumua: **pölyvyöt**, jotka ovat riippumaton ja paljon terävämpi tumma kenttä
kaasun päällä — ja siellä missä se puree, nebula on musta eikä himmeä, mikä
antaa rakennetta joka mittakaavassa; ja **väri tiheyden mukaan** eikä paikan:
ohut reuna sirottaa sinistä, paksut ytimet punertavat. Näytteistys on
kolmitasoinen, koska pallolla (atsimuutti, korkeus) -näytteistys nipistää
molemmat navat ja tämä kohtaus katsoo suoraan ylös.

Kirkkaus vaati ketjun mittaamista eikä yhden luvun nostoa: kolme toisistaan
riippumatonta maskia kerrottuna, kukin keskiarvoltaan alle puolet, jätti
tyypillisen säteen kahdeksaan prosenttiin nimellisestä — eli 0.34 oli
käytännössä 0.03.

**Ilmakehät** ovat nyt kaikilla kappaleilla, myös pienillä. Auringonvalo on
kaksi eri asiaa: **valaistu reuna** (tähteä kohti oleva puoli on paljon
kirkkaampi, ja puoliksi hehkuva reuna on se ainoa vihje joka sanoo että kappale
on *valaistu* eikä hehku itse) ja **eteenpäinsironta** (tähteä kohti ilman läpi
katsottaessa kirkkaampi ja lämpimämpi, näkyy vain sillä sirpillä missä
katsesäde ja valo lähes yhtyvät).

**Kamera kiertää** kohteesta toiseen tasanteiden yläpuolella. Kohteeseen
lukittu kamera näyttää yhden kohteen; kohde joka **liikkuu kentän läpi**
tarkoittaa että sen takana on aina jotain muuta, ja se vaihtuu. Kiertosäde
hengittää, joten kuva käy lähellä kutakin saarta vuorollaan. Alaosat pysyvät
pois kuvasta koska kamera on niiden väärällä puolella — ja korkeus on
rajoitettu **kentän korkeimman tasanteen** yläpuolelle, ei vain kohteen:
kohteen yläpuolella oleminen ei tee mitään saarelle joka sattuu kellumaan
kohdetta ylempänä, ja juuri se laittoi kölin kuvan yläreunaan kahdesti.

---

## Muuta avointa

* **S8:n käytävä on yhä liian kirkas.** Keskikirkkaus 133, kun muiden
  tunnelikohtausten on 20–35. Tätä ei ole pyydetty korjaamaan; se on minun
  havaintoni ja kesken.

### Neljäs kierros: järvi, joki, putous — ja metsää

> "Lisää kappaleisiin lisää metsää, ja tee osaan niistä pieniä järvi josta
> lähtee virtaava joki. Joesta tulee sit reunalla vesiputous. Osa
> vesiputouksista näyttikin hyvältä, pienemmistä kappaleista poistaisin sen
> kokonaan. Ylhäältä katsottuna kappaleiden joet näyttivät nyt karmeilta.
> Laita eri näköisiä järvi+joki+vesiputous kappaleisiin."

**Järvi, joki ja putous ovat nyt yksi kuvaus.** Ne ovat saman asian kolme
olomuotoa — seisova vesi, lähtevä vesi, ja vesi jolta loppuu saari — ja ne
piirretään yhdestä "vesireitistä" (`waterCourses`). Kolme rakentajaa jotka
kukin poimivat oman versionsa samasta hashista pysyvät samaa mieltä täsmälleen
siihen asti kunnes joku muuttaa yhtä niistä.

**Jokainen reitti on erilainen:** järven koko ja kuinka kaukana sisämaassa se
on, uoman leveys, kuinka paljon ja kumpaan suuntaan se mutkittelee, ja onko
saarella yksi reitti vai kaksi — kaikki arvotaan saarikohtaisesti.

**Vain isot kappaleet saavat vettä** (säde ≥ 240). Syy on palautteen lisäksi
tekninen: putous piirretään saareen suhteutetulla leveydellä, joten pienellä
kappaleella se on muutaman yksikön levyinen ja piirtyy naarmuna.

**Miksi joet näyttivät ylhäältä karmeilta**, kolme syytä:

1. Ne olivat **valkoisia**. Kirkas vierivä tekstuuri lukee valona eikä vetenä,
   ja ylhäältä katsottuna — missä joki enimmäkseen heijastaa tummaa taivasta —
   se on juuri se mitä sen ei pidä olla. Vesi on nyt tummaa ja kirkkaus on
   harvoissa kimalluksissa ja putouksen huulella, missä se oikeasti on
   pyörteistä.
2. Niissä oli **kovat reunat**. Maan päälle laskettu neliönauha päättyy suoraan
   leikkaukseen nurmen poikki. Alfa vaimenee nyt uoman poikki, jolloin ranta on
   liukuma märkään kiveen.
3. Ne olivat **liian leveitä**, yli viisi prosenttia saaren halkaisijasta. Joki
   joka on kahdeskymmenesosa maamassasta on kanava.

**Metsä on tuplasti tiheämpi ja kasvaa nyt koko tasanteella.** Vanha versio
poimi puut suoraan yläkärkipisteiden listasta, ja se lista ei ole tasainen
pinta-alan suhteen: ikosfäärin kalotti on tasavälinen *pallolla*, ja profiili
joka litistää sen tasanteeksi puristaa lähes koko kiekon kapeaan
leveyspiirikaistaan. Siksi metsä kasvoi renkaana reunalla ja keskusta oli
paljas. Nyt puu arvotaan tasaisesti kiekolta ja korkeus **kysytään maalta**
(ruudukkohaku saaren omista kärkipisteistä); kiekon ulkopuolelle osunut piste
yksinkertaisesti arvotaan uudelleen, mikä on myös se tapa jolla metsä seuraa
epäsäännöllistä ääriviivaa ilman että sille kerrotaan mikä se on.

Ja mikään ei kasva vedessä: järven ja uoman kohdalle osuvat puut hylätään.

### Viides kierros: yksi joki, putous reunan ohi, kiviä, kumpuilua

> "Kappaleissa ei kannata olla kahta järveä ja kahta jokea --- Ja vesiputouksien
> vesi pitäisi valua kappaleen reunoja pitkin. Nyt useammassa kappaleessa
> vesiputous meni kappaleen läpi. Ja myös vesiputouksen alkukohta --- ei ole
> oikean näköinen. Tähän kannattaisi lisätä esimerkiksi suuria kiviä. Jokien
> uimaan voisi myös reunoille lisätä kiviä ja kappaleiden sisäpuolelle enemmän
> puita. --- Kappaleen sisällä voisi olla myös kumpuilevaa seutua."

**Yksi järvi ja yksi joki.** Valuma-alueella on yksi alin kohta ja vesi lähtee
siitä yhtä suuta pitkin; kaksi rinnakkain lukee koristeena eikä vedenjuoksuna.

**Putous ei enää mene kappaleen läpi**, ja syy oli mitattavissa: ääriviiva on
epäsäännöllinen ja siirtymä on suurimmillaan juuri hartian alapuolella, joten
huulen alla oleva jyrkänne on useimmiten *leveämpi kuin huuli itse* — suoraan
alas pudotettu vesi menee kiven sisään. Nyt jokaiselle saarelle mitataan
verkosta **pullistumaprofiili** (32 atsimuuttisektoria, suurin vaakasäde reunan
alapuolella), ja putous siirtyy ulos sen taakse pudotuksen ensimmäisen
viidenneksen aikana — mikä on myös se mitä vesi tekee, sillä on vaakanopeutta
reunan yli mennessään eikä mikään työnnä sitä takaisin.

**Kiviä huulelle ja rannoille.** Huuli on se kohta jossa kivi on kovinta —
*siksi* vesi menee yli juuri siitä — joten se on ainoa osa reunaa jolla on
lohkareita, ja niiden lisääminen antaa putoukselle sekä syyn että etualan.
Rannoilla kivet ovat sitä mitä uoma heittää itsestään ulos; ilman niitä joki on
kanava. Lohkareet upotetaan kolmanneksen maahan, koska pinnalla lepäävä kivi
lukee sinne asetettuna rekvisiittana.

**Metsää lisää** (tiheys 1400 → 4400) ja korkeudet kolminkertaisella
hajonnalla: samanlaisten kartioiden metsä on tekstuuri, saman kartion metsä
kolminkertaisella kokojakaumalla on metsä.

**Kumpuileva seutu** tasanteella: kaksi oktaavia, ja hienompi pidetään
tarkoituksella 4.5:ssä eikä 6:ssa — kuutosella sen aallonpituus on kolme
ikosfäärin kärkeä ja kummut aliasoituvat tahkoiksi, sama katto joka jyrkänteillä
on.

Ja pienet ulkonemat pienennettiin: kamera kiertää *saarten välissä*, eli juuri
siellä missä ne ovat, joten sadan yksikön möykky osui muutaman halkaisijansa
päähän linssistä ja täytti kolmanneksen ruudusta. Ne ovat siellä antamassa
väleille tunnetun koon, ja ruudun täyttävä on lakannut tekemästä sitä.

### Kuudes kierros: allas kaivetaan maastoon

> "Ei näytä putouksen huulet ja veden valuminen kovin hyvältä vielä. Kaikissa
> putouksissa sama ongelma. Järvissä on myös artifakteja."

Molemmilla oli sama juurisyy — **vesi laskettiin maaston päälle sen sijaan että
maasto olisi tehty sitä varten** — ja korjaus oli järjestyksen kääntäminen.

**Järven artifaktit.** Järvi oli viuhka jonka jokainen kärki pudotettiin
maastoon. Se ei ole järvi vaan väännetty levy: siellä missä maa nousi sen läpi,
pinta leikkautui pois ja järveen jäi suoraviivaisia loveja. Järven pinta on
**tasainen**, yhdessä korkeudessa, ja syy ettei se leikkaa maata on että maa on
**allas** sen alla.

Se tarkoittaa että kiven on tiedettävä missä vesi tulee olemaan — eli reittiä ei
voi valita valmiista verkosta. Reitti valitaan nyt pelkästä asettelusta
(suunta, etäisyys sisämaahan, koko) **ennen** kiveä, ja `rockPoint()` kaivaa:

* **altaan**, malja johon tasainen vesipinta mahtuu leikkaamatta;
* **uoman**, joka lähtee altaan reunalta ulospäin — joki makaa nyt jossakin
  eikä jonkin päällä, mikä on ero joen ja maalatun raidan välillä;
* ja **loven reunaan**, koska uoma jatkaa kaivamista loppuun asti. Vesi menee
  reunan yli matalimmasta kohdasta; sen matalimman kohdan kaivaminen on se mikä
  antaa putoukselle syyn olla juuri siinä.

**Putouksen huuli.** Joki päättyi *reunan kärkipisteeseen*, joka on jo
jyrkänteellä, joten nauhan viimeiset neliöt työntyivät ilmaan litteänä
valkoisena laattana. Nyt tasanteen todellinen loppu **kävellään** ulospäin
uomaa pitkin kunnes maa loppuu, ja joki päättyy siihen ja putous alkaa siitä.

Valmiista pinnasta mitataan kolme lukua: **vedenpinnan korkeus** (altaan pohja
plus täyttö), **rantaviiva** (mistä tuo tasainen taso kohtaa maljan — haettuna
neljäänkymmeneen suuntaan, koska arvattu säde jättää järven reunan toisella
puolella ilmaan ja toisella maan alle) ja **huuli**.
### Seitsemäs kierros: verkko oli koko ajan se rajoite

> "Uomat ovat nyt ilman vettä, ja järvet kans soita. Eli lisää vettä niihin. Ja
> vesiputoukset kans katosivat kokonaan johonkin. Ja koita laittaa veteen
> semmoinen virran solina, ainoat vesiputoukset jotka nyt näkyivät ovat ihan
> staattisia. Huomasin kans että osassa kappaleita "ilmakehä" ei kata koko
> kantta."

Neljä oiretta, ja kolme niistä osoittautui saman asian oireiksi.

**Tasanteen keskusta oli käytännössä näytteistämätön.** Profiili `säde =
(1 - lat²)^0.14` pitää vaakasäteen 98 prosentissa vielä leveysasteella 0.4,
joten *melkein jokainen* yläpuoliskon kärki osui kannen uloimpaan
viideskymmenesosaan ja keskusta oli kourallinen valtavia kolmioita. Viidenneksen
säteestä levyinen järvi sai alleen **kaksi kärkeä**. Siitä seurasi kaikki muu:
allas ei voinut tulla kaivetuksi maljaksi vaikka se kuinka kaivettiin, pintaruudukko
osasi kertoa vain portaikon, ja joki jouduttiin laskemaan sekoitukselle pisteitä
joita ei ollut. Nyt leveysaste luetaan suoraan **pohjasäteenä** ja korkeus
otetaan siltä leveysasteelta joka *samalla* profiililla olisi tuolla säteellä:
sama pinta, sama siluetti, mutta kärjet jakautuvat tasaisesti reunalta
keskustaan. Järven alla on nyt 150–200 kärkeä. (Vyöhykkeiden rajat — kansi,
hartia, köli — siirtyivät samalla mittaamaan sitä mitä ne oli kirjoitettu
mittaamaan; hartia otetaan nyt pohjasäteestä, koska kapea rengas säteessä on
partaveitsenohut kaista leveysasteessa ja pieneltä saarelta loppuivat köynnökset.)

**Järven muoto päätetään, ei etsitä.** Edellinen kierros *mittasi* rantaviivan
kävelemällä ulospäin kunnes maa laskee veden alle, eikä sellainen kävely osaa
erottaa etsimäänsä allasta viereisestä painanteesta: osalla suuntia se jatkoi,
tulvitti naapurin ja palasi kaksilohkoisena möykkynä, osalla se törmäsi omaan
hakurajaansa ja palasi täydellisenä ympyränkaarena. Molemmat näkyivät kuvassa
yhtä aikaa. Nyt yksi funktio kertoo altaan säteen suunnittain, `rockPoint()`
kaivaa kiven siihen ja mittaus lukee rantaviivan samasta paikasta — ja
täyttöaste ja ranta ratkaistaan samasta käyrästä eikä silmämääräisesti.
Verkon karkeuden varalta jäi kaksi rajattua korjausta: **pinta nousee** niin
korkealle että se ylittää sen mitä verkko altaan sisällä oikeasti tekee, ja
**ranta vetäytyy** suunnittain sisäänpäin siellä missä maa on yhä pinnan
yläpuolella — sisäänpäin vain, ei koskaan ulos.

**Uoma oli kapeampi kuin verkko pystyy näyttämään.** Ura oli 0.05 sädettä
leveä, kärkiväli 0.053: kaivaus putosi näytteiden väliin ja verkko palasi ilman
sitä. Siksi maassa ei ollut uomaa ja maahan laskettu nauha oli maan sisällä —
"uomat ilman vettä". Uoma on nyt **laakso**, useita kärkivälejä leveä ja
matalampi kuin ura oli, ja **joki on oma kapea nauhansa** sen pohjalla; niillä
on nyt eri leveys, koska vain toisella on verkon asettama alaraja. Rantakivet
seuraavat jokea, eivät laaksoa.

**Vesi näyttää vedeltä vain kontrastin kautta.** Edellinen versio oli
*kirkkaampi ja tasaisempi kuin maa*, ja pehmeäreunainen laventelilevy tummalla
vihreällä on pelto jolla makaa pilvi. Kolme asiaa, kaikki kontrastia: vesi on
**tummaa** (nyt suunnilleen ympäröivän metsän arvossa), se **kimaltaa** —
takaisin tulee sumu pieninä kirkkaina paloina, ei tasaisena huuhteluna — ja se
**loppuu**: ranta oli häivytys puolen säteen matkalla, ja juuri se liuotti
ääriviivan höyryksi. Liike on molemmilla: järvellä kaksi vastakkaiseen suuntaan
kulkevaa maininkia, joessa harjat jotka kulkevat alavirtaan ja **sitä nopeammin
mitä pidemmälle ne ovat tulleet** — se on se solina, ja se on myös se mikä
erottaa virtaavan veden paikallaan värisevästä.

**Putouksen huuli oli se valkoinen laatta.** Nauha kirkastui puoliväliin
valkoista viimeisen seitsemänneksensä aikana ja piti täyden peiton viimeiseen
kärkeensä asti, eli se päättyi kovareunaiseen hohtavaan puolisuunnikkaaseen
reunalla — juuri se mihin "vesiputouksen alkukohta ei ole oikean näköinen" on
koko ajan osoittanut. Reunan yli menevä vesi tekee päinvastoin: se kiihtyy, siis
**kapenee ja tasoittuu**, ja valkoinen alkaa vasta kun se on hajonnut, mikä on
jo reunan takana ja putouksen asia. Nyt loppusuora kapenee, sen pintakuvio
laantuu ja se luovuttaa vuoron häipymällä eikä loppumalla.

**Putoukset olivat kadonneet kiven sisään.** Ne ripustettiin *uoman suuntaan
järvestä*, mutta järvi on sivussa, joten huulen suunta saaren keskipisteestä
eroaa siitä 20–30 astetta — useammalla saarella se on kiven sisäpuoli. Nyt
huulen oma ulkosuunta mitataan keskipisteestä ja putous ripustetaan siihen.

**Ilmakehä ei kattanut kantta**, koska kuori skaalattiin kiinteällä kertoimella
1.42 vaikka ääriviivan kohina vie osan saarista yli 1.5:n. Kuori mitoitetaan nyt
verkosta luetusta suurimmasta vaakasäteestä; jokaisella saarella se on nyt
vähintään 1.22-kertainen kannen levimpään kohtaan.

### Kahdeksas kierros: liike jota ei ollut, ja kaksi tasoa jotka eivät kohdanneet

> "Vesiputoukset ovat 2D, eli sivusta katsottuna on silhuetti. Tämä lienee yksi
> ongelmista. Järvet leijuvat ilmassa, eivät ole kuopassa. Sama jokiin, joki on
> eri tasolla kuin järvi - eli ne eivät näytä olevan samaa. Joet eivät myös
> näytä vieläkään virtaavan."

**Putous kääntyy katsojaan.** Se oli taso kiinteässä maailmansuunnassa, ja
kiinteässä suunnassa oleva taso on sivusta katsottuna viiva. Tämä on **kolmas
kerta** kun sama virhe löytyy tästä elokuvasta — tulivuoren savu, ja sitä ennen
viidakon hiukkaset — ja se näyttää joka kerta eri bugilta: vesi on paikallaan,
se on valaistu, se liikkuu, ja se on pahvia. Nyt neliö kääntyy **vain
pystyakselin ympäri**: vesi putoaa suoraan alas, joten se saa kääntyä katsojaan
mutta ei kallistua. Samalla se kapeni ja himmeni, koska aina kohtisuoraan
kääntyvä pinta näyttää koko leveytensä koko ajan.

**Ja se todellinen syy siihen ettei mikään näyttänyt virtaavan.** Sekä joen että
putouksen kuvion vieritysnopeus oli *paikan funktio* — putouksessa
`2.6 + 5.2*dd`, joessa nopeampi alavirtaan. Kun vaihe on `y - t*nopeus(y)`, sen
gradientti on `1 - t*nopeus'(y)`: **kuvion paikkataajuus kasvaa rajatta ajan
myötä**. Tämä on täsmälleen sama virhe kuin S9:n räpsytyksessä, ja tässä
kohtaa elokuvaa (t ≈ 170–185 s) putouksen säikeitä näytteistettiin
kolmekymmenkertaisesti niiden omaan taajuuteen nähden. Se ei piirtänyt
vesisäikeitä lainkaan vaan valkoista kohinaa joka arpoutuu uudelleen joka
ruudulla — ja Nyquistin yli näytteistetyssä kohinassa **ei ole suuntaa**, joten
silmällä ei ole mitään mitä seurata. Siksi "putoukset ovat ihan staattisia" ja
"joet eivät näytä virtaavan" olivat sama bugi, ja siksi kumpikaan ei korjaantunut
kirkkautta tai nopeutta säätämällä.

Korjaus: **aikatermi on vakio**, ja kaikki mikä kuuluu muuttua matkan varrella
pannaan **staattiseen paikkavenytykseen** — säikeet venyvät edetessään, mikä on
sitä mitä kiihtyvä vesi tekee pinnalleen, ja sen gradientti pysyy rajattuna
ikuisesti. Samalla poikittaistaajuudet laskettiin siihen mitä nauha oikeasti on
ruudulla (15–20 pikseliä leveä), koska yksitoista kohinasolua sen yli on sama
aliasointi sivusuunnassa.

Ja kolmas asia samasta paikasta: putouksen neliöt olivat kahdeskymmenesosan
korkuisia mutta yhdeksästoistaosan päässä toisistaan, eli **jokainen limittyi
naapurinsa kanssa yhdeksän prosenttia** — ja lisäävässä sekoituksessa limitys on
kirkas raita. Kaksikymmentä sellaista on se tikapuukuvio joka on palannut tähän
putoukseen kerta toisensa jälkeen; se selvisi jokaisesta varjostimeen
kohdistetusta korjauksesta, koska se ei ollut koskaan varjostimessa.

**Järvi on kuopassa.** Edellinen kierros mittasi altaan sisältä korkeimman
kohdan levyisellä kiekkoanturilla — ja anturin oli pakko olla vanhan kärkivälin
levyinen jotta se osuisi mihinkään, joten järven keskeltä otettu näyte raportoi
**pankin**, kolmen kärkivälin päästä ja lähes kokonaisen altaan korkeammalta.
Pinta nostettiin siis puhdistamaan pankki joka ei ollut koskaan veden alla,
allas täyttyi reunojaan myöten ja järvi tuli ulos tasoissa ympäröivän kentän
kanssa. Nyt kun kansi on tasaisesti näytteistetty, järven alla on parisataa
kärkeä eikä mitään tarvitse haparoida: kärjet lajitellaan suuntalokeroihin ja
jokainen lokero on oma säteittäinen maastoprofiilinsa. Täyttöaste laskettiin
0.68:aan, joten rannan ja altaan reunan väliin jää näkyvä pankki.

**Joki ja järvi ovat samaa vettä.** Uoma oli kaivettu kiinteään osuuteen altaan
syvyydestä, syvemmälle kuin järven varalaita — eli uoman pohja oli suulla lähes
kokonaisen altaan verran *sen veden alapuolella jota sen piti kuljettaa*. Nauha
makasi sillä pohjalla ja ne olivat näkyvästi eri korkeudella. Kaksi korjausta:
**kynnys on vedenpinnan tasolla** (järvi lähtee matalimmasta kohdastaan, ja se
kohta *on* pinnan tasolla — se on mikä pinnan määrää) ja uoma **on kaivettu
valmiiksi jo rannalla**, eli lovi menee altaan reunan läpi. Ja joen pinta ei ole
enää maasto plus vakio vaan **monotonisesti laskeva taso joka alkaa järven
korkeudesta**: se lähtee järvestä järven korkuisena eikä voi koskaan nousta.

### Yhdeksäs kierros: putous ei ole pino, ja ilmakehän sisällä on jotakin

> "Yksi vesiputous on vielä hassun näköinen (loppupuolella). Voitaisiin vähän
> lisätä objektien biosfääreihin 'kaasua', eli ilmakehän sisällä vähän kaasua
> joka aiheuttaa pienen optisen vääristymän ja värjäytymän katsottuna avaruutta
> vasten. Ja objekteissa joissa on puita, voisi lisätä puiden joukkoon vähän
> muuta pienkasvillisuutta ja yksityiskohtia."

**Putous on nyt yksi nauha.** Jokainen sauma joka tässä putouksessa on koskaan
ollut tuli samasta päätöksestä: se rakennettiin kahdestakymmenestä erillisestä
instanssitasosta pinottuna. Ensin ne limittyivät, ja lisäävässä sekoituksessa
limitys on kirkas raita — tikapuut. Sitten ne pantiin täsmälleen vieretysten, ja
ne piirtyivät *silti* mustat raot välissään: instanssimatriisit sanovat että
jokaisen yläreuna on edellisen alareuna, ja pikselit sanoivat muuta. Todistin
sen värittämällä instanssit vuorotellen — kaikki kaksikymmentä olivat paikalla,
ja niiden välissä oli tyhjää.

Sen sijaan että olisin jatkanut väittelyä sen kanssa, putous on nyt yksi
kolmioliuska: rivi kärkiä per asema pudotusta alas, naapurit jakavat kärkensä,
eikä saumaa ole olemassa mitä pilata. Putoamiskoordinaatti on kärkiattribuutti
jota interpoloidaan liuskaa pitkin — se on se mitä varjostin on koko ajan
halunnut. Billboardaus tehdään nyt kärkikohtaisesti: keskilinja on
maailmakoordinaateissa ja puolileveys työnnetään ulos katsesuuntaa vastaan
kohtisuoraan vaakasuuntaan, joten levy kääntyy katsojaan kallistumatta.
Asemia nostettiin kahdestakymmenestä neljäänkymmeneenneljään, mikä nyt maksaa
vain kärkiä.

**Kaasua ilmakehän sisällä.** Kuori on fresnel-viiva: se kertoo missä ilma
loppuu, ja se on lisäävä, joten se voi vain kirkastaa. Ilma jossa on jotakin
tekee myös päinvastoin — se ottaa takanaan olevan värin ja siirtää sitä — joten
tämä kerros sekoittuu normaalisti eikä lisäävästi, ja avaruutta vasten se lukee
värjäytymänä eikä hohteena. Kaksi asiaa antaa sille optisen luonteen: **se ei
ole tasainen** (tiheys on hidas kolmiulotteinen kenttä joka ajelehtii kuoren
läpi, joten kaasu on pankkeina ja juovina — pankin läpi nähty tähti himmenee ja
värjääntyy, aukon läpi nähty ei), ja **sen reuna liikkuu** (pinta siirtyy oman
normaalinsa suuntaan samalla kentällä, eli ilman ja avaruuden raja on pehmeä,
epäsäännöllinen ja muuttuva — niin lähelle taittumista kuin ilman kopiota
takana olevasta ruudusta pääsee).

Ensimmäinen versio oli kuusi kertaa voimakkaampi ja ilmakehistä tuli
lasikupuja — saippuakuplia kovine ympyränkehineen, mikä on juuri päinvastoin
kuin tarkoitus: ilmamassa on jotakin jonka huomaa reunalla eikä missään
muualla. Ja kirkkain kohta on nyt **kaistale hiukan reunan sisäpuolella**, ei
reuna itse: siluetilla kuori yksinkertaisesti loppuu, joten siihen huipentuva
termi piirtää kovan ympyrän — ääriviivan saaren ympärille eikä ilmamassaa sen
takana.

**Aluskasvillisuutta.** Pelkkinä latvuksina piirretty metsä lukee nurmikolle
leimattuna kuviona, ja syy on että maassa on täsmälleen yhtä kokoa olevia
asioita: jokainen kohde ruudussa on saman muutaman pikselin korkuinen kartio,
joten silmällä ei ole mistä rakentaa mittakaavaa. Sitä ei korjaa lisää puita
vaan **pienempiä asioita niiden välissä** — pensaita, matalaa kasvillisuutta,
muutama kivi — neljäsosassa puun koosta ja kolminkertaisena määränä, jolloin
maassa on kaksi mittakaavaa yhden sijaan. Monikulmainen möykky eikä kartio,
koska aluskasvillisuus on pyöreää ja havupuu ei, ja tällä etäisyydellä siluetti
on ainoa mikä ne erottaa. Leveät ja matalat lukevat pensaina, korkeammat
varvikkona, ja harmaaksi väritetty kymmenesosa kivinä ruohikossa. Vesirajaus on
nyt yksi funktio jota sekä metsä että aluskasvillisuus käyttävät — kaksi kopiota
siitä ajautuisi erilleen, ja purossa seisova pensas on juuri se merkki että
kasvit ja vesi on tuotettu eri koodilla.

### Kymmenes kierros: kohinasolun muotosuhde, ja se mikä repii veden auki

> "Tämä putous on nyt vielä hassun näköinen. Eli pitäisi koittaa
> realistisemmaksi."

Kolme vikaa, ja tärkein niistä oli sellainen jota ei näe mistään yksittäisestä
rivistä.

**Kohinasolut olivat sata kertaa korkeampia kuin leveitä.** Säikeiden taajuudet
olivat kiinteitä lukuja: pari solua pudotusta alas ja tusina sen poikki. Putouksella
joka on neljä omaa leveyttään pitkä se on suunnilleen neliö ja toimii; putouksella
joka on kolmekymmentä leveyttään pitkä — ja useimmat näistä ovat — solu on sata
kertaa korkeampi kuin leveä, ja sadan suhde yhteen ei ole säie vaan **pehmeä
liukuväri jossa on pari haaleaa raitaa**. Sitä lähikuvat näyttivät: kiillotettu
metallipalkki. Solujen määrä pudotusta alas johdetaan nyt putouksen omasta
muotosuhteesta (pituus omina leveyksinään, kärkiattribuuttina) ja poikittaisten
määrästä niin että solun muoto on noin neljä yhteen — korkea ja kapea, mikä on
mitä säie on. Vieritysnopeus skaalataan samalla luvulla, jotta vesi ylittää
pudotuksen suunnilleen samassa ajassa putouksen koosta riippumatta. Sama korjaus
tehtiin jokeen: kaksi solua kymmenen kertaa leveyttään pidemmän nauhan matkalla
ovat kymmenen kertaa liian korkeita soluja, eikä sellainen piirrä väreilyä vaan
kiskon.

(Ja tämä on eri asia kuin kahden kierroksen takainen virhe. Silloin
*interpoloitu* koordinaatti oli aikatermin sisällä ja gradientti kasvoi rajatta;
nyt kertoimena on yksi luku per putous, joka on vakio koko pinnalla.)

**Putous ei hajonnut.** Oikea putous lähtee huulelta yhtenäisenä levynä eikä
pysy sellaisena: muutaman oman leveytensä päässä levy on repeytynyt erillisiksi
säikeiksi, ja alempana ei ole enää mitään yhtenäistä. Tämä oli umpinainen nauha
koko matkan — säikeet olivat vain kirkkauskuvio *päällä* levyä joka ei koskaan
hajonnut, ja levyn oma ääriviiva on se minkä silmä lukee. Nyt runko on
**maskattu säiekentällä**, ja maski ottaa vallan syvyyden myötä: yhtenäinen
huulella, säikeitä keskellä, riekaleita alhaalla. Missä säikeitä ei ole, ei ole
mitään — se on se mikä sallii katsoa vesiputouksen läpi. Ja höyry ei enää pyyhi
niitä pois: se leikkasi rungosta 85 prosenttia puolivälin alapuolella, joten
jokaisen putouksen koko alapuolisko oli sileä piirteetön palkki kovine
reunoineen.

**Lisäksi kaksi asiaa lähietäisyydelle.** Ääriviivat eivät ole viivoittimella
vedettyjä: sekä putouksen leveys että joen rannat vaeltavat omalla hitaalla
kentällään. Ja hienoin yksityiskohtakerros kytketään päälle **omalla
jalanjäljellään**: taajuudet on valittava sen mukaan mitä putous on pikkukuvana
kentän toisella laidalla, mutta kamera lentää myös yhden säteen päähän niistä, ja
silloin ne samat säikeet ovat kymmenen pikselin levyisiä. Molemmat voivat olla
totta yhtä aikaa jos hieno kerros sammutetaan `fwidth()`:llä — koordinaatin
derivaatalla pikseliä kohti — kun sen solu menee pikselin alle, ja sytytetään
takaisin kun kamera tulee lähelle. Analyyttinen antialiasointi, ja se on ainoa
rehellinen tapa saada pinta joka on oikein kahdella kymmenkertaisesti eroavalla
etäisyydellä.

**Ja kivet.** Lohkareet rakennettiin `rockPoint()`:lla, joka on *saaren* muoto —
tasanne kölin päällä — pienennettynä ja litistettynä. Kolmanneksen maahan
upotettuna niistä jäi näkyviin pikkuruisen tasanteen litteä yläpinta, ja
lähikuvassa joen rannat olivat täynnä sitä mikä luki erehtymättä
lumpeenlehtinä. Lohkareella ei ole ylä- eikä alapuolta eikä profiilia; se on
pallo johon kuhmut on hakattu, ja se on nyt kaikki mitä se on.

### Yhdestoista kierros: kaksi mittausta samasta käyrästä, ja kivet pois vedestä

> "Kivet leijuvat joen ja putouksen päällä. Ja putous ei vieläkään ole
> kohdillaan missä joki päättyy. Haluaisin että kivet eivät ole joen eikä
> putouksen päällä."

**Putous oli väärässä paikassa koska huuli käveltiin suoraa linjaa.** Nauha
piirretään keskilinjalle joka **mutkittelee** — leveimmillään kymmenesosan
säteestä sivuun — mutta huuli haettiin kävelemällä suoraan ulos järvestä. Piste
johon putous ripustettiin ja piste johon joki oikeasti päättyi olivat siis sen
verran erillään, ja vesi meni reunan yli kohdasta jota puro ei koskaan
saavuttanut. Kaksi mittausta samasta käyrästä, otettuna eri tavoin — tämän
tiedoston jokaisen bugin toistuva muoto. Huuli käveltään nyt samaa mutkaa jota
nauha käyttää, ja putous alkaa myös samalta korkeudelta kuin nauhan pinta (joen
pinta on kohotettu uomastaan, ja putous on sitä samaa vettä) sekä häivytetään
sisään parin prosentin matkalla, jottei liuskan ensimmäinen rivi piirtäisi
kovareunaista kiilaa huulelle.

**Kivet eivät ole enää vedessä.** Vesi ei kirjoita syvyyspuskuria — sen on
pakko olla läpinäkyvä — joten purossa seisova kivi piirtyy suoraan sen läpi ja
lukee **pinnalla kelluvana lohkareena**. Huulen kivet oli hajautettu huuleen
keskitetylle kaistalle, mikä pani kolmanneksen niistä keskelle lovea; ne ovat
nyt **veden molemmin puolin**, putouksen levyn ulkopuolelta alkaen ja siitä
ulospäin — ja se on myös se mitä ne ovat *varten*, ne olkapäät joiden VÄLISTÄ
vesi lähtee. Rantakivet olivat 1.15–2.05 kertaa uoman puolileveyden päässä,
mutta nauhan oma puolileveys on 0.80–1.35 ja sen piirretty reuna vaeltaa vielä
neljänneksen ulommas varjostimen kohinalla, joten osa niistä oli virran alla.
Nyt marginaali on 1.6-kertainen nauhan omaan puolileveyteen plus kiven oma säde,
eli kivi on veden vieressä eikä nojaa siihen.

### Kahdestoista kierros: vesi ei mene kiven sisään, ja loppu ei leikkaannu

> "Ihan lopussa on vielä jotain artifakteja/leikkaantumista yhdessä koskessa ja
> vesiputouksessa." — ja "Myös n. bar 101 jälkeen näkyvällä putouksella vesi
> katoaa kiven sisään."

Sama juuri molemmissa: vesilevy leikkautui maastoon. Vesi ei kirjoita
syvyyspuskuria mutta se kyllä *testaa* sitä, joten missä maa on lähempänä, maa
piirtyy veden päälle — ja koska maastokolmiot ovat isoja ja tasaisia, jälki on
täsmälleen se mitä kuvassa oli: **täysin suora vino leikkaus veden poikki**.

**Joen pinta on nyt suffiksimaksimi**, ja se yksi rivi on koko korjaus. Kahden
asian on oltava totta yhtä aikaa: levy ei saa koskaan **nousta** (vesi ei virtaa
ylämäkeen, ja yksikin nouseva pätkä on ensimmäinen minkä silmä huomaa) eikä olla
**kiven alla** (jolloin maasto peittää sen ja puro katoaa rinteeseen). Juokseva
*minimi* alavirtaan täyttää ensimmäisen ja rikkoo toisen: kun levy on kerran
laskenut, se ei voi nousta takaisin, joten mikä tahansa kumpare alempana hautaa
sen. Juokseva **maksimi taaksepäin suulta** täyttää molemmat: korkeus kussakin
kohdassa on korkein maasto missä tahansa sen alapuolella, mikä on
rakenteellisesti ei-nouseva eikä koskaan kiven alla. Fysikaalisesti se on myös
oikein — juuri niin puro tekee kun jokin alempana patoaa sen: se lammikoituu.

Ja etäisyys mitataan korkeimpaan **kärkeen** nauhan leveydeltä, ei tasoitettuun
ruudukkoon. Ruudukko on sekoitus eikä sekoitus näe kumparetta; kolmiot kärkien
välissä ovat aina korkeimman kärjen alapuolella, joten maksimi on varmalla
puolella siinä ainoassa suunnassa jolla on väliä.

**Putouksen leikkaantuminen oli kiveä sen edessä.** Se ripustettiin
pullistumaprofiilin *yhteen* sektoriin, mutta levy on useita omia leveyksiään
leveä ja profiili on mitattu kolmeenkymmeneenkahteen sektoriin — yksi sektori ei
kerro mitään kalliosta neljänneksen päässä levyn toista laitaa. Nyt otetaan
naapurisektorien levein, marginaali on kaksinkertainen levyn leveyteen ja vesi
irtoaa reunasta **kymmenesosassa** pudotusta eikä viidenneksessä: kallio on
levimmillään juuri hartian alla, joka on täsmälleen se kohta jossa vesi on
matkansa alussa.

**Ja liitos on pehmeä.** Nauhan viimeinen rivi on suora viiva virran poikki —
liuskan on loputtava jonnekin — ja reunaa vasten se lukee siistinä vinona
leikkauksena. Sitä ei voi saada loppumaan ei-mihinkään, joten se loppuu
**pehmeästi**, ja putous häivytetään sisään saman matkan päässä: kaksi pehmeää
reunaa päällekkäin luetaan yhtenä vesimassana, ja se mitä reuna tekee niiden
välissä lakkaa olemasta tapahtuma.

### Kolmastoista kierros: mitattu etäisyys, ja kappaleet irti toisistaan

> "Ei korjaantunut vielä, vähän parani. Ja muutama objekti on vielä
> päällekkäin tai ihan vieri vieressä. Ne vois erottaa."

Edellinen kierros pehmensi oireen; tämä mittasi sen. Kirjoitin tarkistukset
jotka laskevat **valmiista verkosta** kuinka lähellä kiveä vesi oikeasti on, ja
lukemat kertoivat kaksi asiaa kerralla.

**Putouksen pullistumataulukkoa luettiin väärässä kehyksessä.** Taulukko
täytetään kunkin kärjen **paikallisella** suunnalla, mutta sitä kysyttiin huulen
**maailmansuunnalla** — ja verkko on kierretty saaren omalla yaw-kulmalla, joten
putous kysyi kuinka leveä kallio on aivan toisessa kohdassa reunaa. Saarella
jonka kierto sattuu olemaan pieni se toimi; muilla se palautti luvun eri osasta
jyrkännettä, ja siitä ne suorat leikkaukset. Mitattuna putousten pahin
etäisyys kiveen oli **negatiivinen**; nyt se on 24–82 yksikköä, eli koko levyn
leveys on kiven ulkopuolella joka korkeudella.

Ja yksi luku koko pudotukselle ei riitäkään: vesi tarvitsee tilaa **omalla
korkeudellaan**, mikä on pinta eikä luku. Siluetti mitataan nyt
kuuteenkymmeneenneljään suuntaan ja viiteenkymmeneenkuuteen korkeuskaistaan, ja
rata ratkaistaan kolmesta ehdosta yhtä aikaa: kaari jonka vaakanopeus antaa,
kallio sillä korkeudella, ja se ettei vesi voi enää palata sisäänpäin — putoava
vesi menee suoraan alas, joten juokseva maksimi on sekä fysiikka että turva.

**Joen anturi ei ulottunut nauhan reunan ohi.** Korkeimman kiven haku oli nauhan
levyinen, mutta kolmio jonka kärjet ovat nauhan ulkopuolella voi silti kulkea
sen alitse — juuri se kivi jää huomaamatta joka veden leikkaa. Anturi ulottuu
nyt kärkivälin verran reunan ohi, ja mitattu etäisyys on tasan se mitä sen
kuuluukin olla (1.5 % säteestä) jokaisella saarella jokaisessa kohdassa.

**Ja kappaleet on työnnetty erilleen.** Asettelu antaa kullekin saarelle paikan
sen omista hasheista, eikä kahdella hashilla ole mitään keinoa tietää
toisistaan: mitattuna saari kuusi oli 378 yksikköä saaren viisi **sisällä**, ja
kolme muuta paria oli alle sadan päässä kosketuksesta. Relaksaatio uudelleenarvonnan
sijaan — asettelun omat päätökset (kokojakauma, kumpi puoli käytävää, matala
pystysuuntainen kaista) ovat se mikä saa kentän lukemaan, ja hylkäysotanta
purkaisi ne hiljaa. Jokainen limittyvä pari työnnetään erilleen keskipisteidensä
välistä linjaa pitkin, pienempi antaa enemmän periksi, pystysuunta vaimennettuna
(kenttä on murtunut *kerros*, ei sirote) ja käytäväetäisyys palautetaan joka
kierroksella. Marginaali on pidetty niin pienenä kuin se voi olla ja silti
toimia, koska kameran rata rakentuu asettelun päälle. Nyt joka parin välissä on
vähintään 112 yksikköä tyhjää.

---

## Avoimet, tietoisesti myöhemmäksi jätetyt

**S11 — tukos yhdessä putouksessa.** *(kolmastoista kierros; kaksi syytä korjattu, ks. alla)*

> "Yhdessä putouksessa näkyi vielä tukos. Nyt uudelleenjärjestelyn jälkeen
> kuitenkin tilanne on niin hyvä, että jätän vain merkinnäksi et korjataan
> myöhemmin tukos."

Yksi putous näyttää tukkeutuvan matkallaan. Todennäköisin syy on tiedossa ja
kirjattu tässä, jotta seuraava kerta ei ala alusta: putouksen rata on **juokseva
maksimi** — se ei voi enää palata sisäänpäin sen jälkeen kun kallio on työntänyt
sen ulos (`buildFalls`, `rrs`). Se on oikein putoavalle vedelle, mutta jos
siluettitaulukko raportoi yhdessä korkeuskaistassa poikkeuksellisen leveän
kohdan — irrallisen ulkoneman, tai kaistan jonka naapurisektorien maksimi vetää
liian ulos — koko loppupudotus lukittuu sen levyisenä ulos, ja pullistuma sen
kohdalla lukee tukoksena. Tarkistettavaa siis kaksi:

* `profAt()`:n `sectSpan`/`bandSpan` (nyt 3 ja 2) — leveä ikkuna on turvallinen
  suuntaan "ei mene kiven sisään" mutta ostaa sen sillä että yksittäinen
  ulkonema säteilee useaan kaistaan;
* ja se, kannattaisiko juoksevan maksimin **rentoutua** hitaasti alaspäin
  (vesi ei palaa sisään, mutta ulkoneman ohitettuaan sen ei tarvitse jäädä sen
  levyiseksi loppumatkaa) — esimerkiksi salliva lasku muutama prosentti per
  asema, yhä kiven ulkopuolella pysyen.

Mittatyökalu on olemassa: `worst clearance` -tarkistus (fall-kärjet vs.
`top+rim+keel` samalla korkeudella ja suunnalla) antoi tämän kierroksen jälkeen
24–82 yksikköä joka putoukselle, eli tukos ei ole kiven sisällä olemista vaan
radan muotoa.

**S7 — tulivuoret.** *"Parannellaan myöhemmin tulivuoria jos tarvii."* — ✅ tehty,
ks. "S7 \"Volcanic\": savu oli valokuva" alempana.

**S8 — käytävä.** Ei pyydetty, oma havainto: S8:n käytävä on kirkkaampi kuin
muiden tunneliscenejen. — ✅ tehty, ja syy oli aivan muu kuin kirkkaus; ks.
"S8 / S10 / S15" alempana. Sama vika löytyi mittaamalla myös S10:stä ja
S15:stä.

---

## Katselmus koko elokuvasta

Ajoin 51 ruutua, kolme jokaisesta 17 kohtauksesta. (Ensimmäinen yritys meni
metsään omasta virheestäni: `stills.mjs` ottaa kohtauksen `--scene`-lipusta ja
jättää ilman sitä oletukseksi S4:n, joten kaikki ruudut olivat S4 väärään aikaan
— valkoisia. Työkalu ei siis kertonut mitään elokuvasta ennen kuin ajoin sen
kohtaus kerrallaan.)

Löydökset tärkeysjärjestyksessä: **S13** (litteä laatta puolessa ruudusta),
**S12** (piirteetön sumu koko kohtauksen), **S8/S10** (pestyt vaaleat
käytäväruudut), **S5** (keskikohta mössöä), **S9** (keskikohta lähes musta).
Loput näyttivät ehjiltä.

### S13 "Bleed": kolmas yritys, ja kaksi hylättyä

> "Ei hypätä eteenpäin. S13 tuntuu aika huonolta nyt. Viidakko on 100% pimeä
> nyt, ja tulivuoret leikkaantuvat. Mitä jos vaihdettaisiin strategiaa, ja
> tehdään hilarakenne jossa on kolme hilaa joista näkyvät nämä maailmat,
> hilojen välillä on pelkkää sumua ja maailmat eivät leikkaa toisiaan
> varsinaisesti?"

Hilarakenne se on, ja kaksi hylättyä versiota kannattaa kirjata ylös, koska
molemmat kaatuivat samaan asiaan ja kolmas toimii nimenomaan kieltäytymällä
siitä.

**Yksi kohtaus, kaikkien maailmojen ryhmät, lomitettuna syvyyspuskurilla.**
Paperilla tämä on syvyystietoinen ristihäivytys ilmaiseksi: joka pikselissä
näkyy se maailma joka on lähempänä. Ruudussa se on kaksi maisemaa jotka
leikkaavat toisensa niitä saumoja pitkin joilla niiden geometria sattuu
kohtaamaan — tulivuori jonka saniainen viiltää poikki, viidakon lattia jonka
laavatasanko kaataa. Sauma ei ole viritysvirhe; se **on** se mitä lomitus on.

**Yksi kamera, maailmat siirrettynä ja skaalattuna sen luo.** Periaatteessa
parempi — maailmat ovat omissa kammioissaan eivätkä voi leikata toisiaan —
mutta se pyytää jokaista maailmaa selviämään siitä että se kierretään ja
skaalataan kahdellakymmenellä, eivätkä ne selviä. Maailma ei ole pelkkää
geometriaa: se on geometria **plus kamera plus sumun tiheys maailmayksiköissä
plus rajauspallot joita vasten renderöijä karsii**. Skaalaa ryhmä ja sumu on
kolmenkymmenen mitan syvyinen ja maailma on valkoinen huuhtelu; poista karsinta
joka menee väärin ja taakse tarkoitettu taivaskupu täyttää ruudun. Viidakko
palasi pitkospuina joiden ympärillä ei ollut viidakkoa.

**Joten mitään ei muunneta.** Jokainen kammio on se maailma piirrettynä omalla
kohtauksellaan, oman kameransa läpi, omaa rataansa pitkin, oman
kompositorinsa asetuksilla — eli viidakko näyttää täsmälleen S5:ltä koska se
**on** S5, ja tulivuoret S7:ltä. Vain yksi maailma piirtyy kerrallaan, joten
mikään maailma ei voi leikata toista: se ei ole järjestetty vaan rakenteellista.

Ne yhdistää sumu. Jokainen kammio aukeaa siitä ja sulkeutuu siihen, ja maailma
vaihtuu sillä hetkellä kun sumu on läpinäkymätön — leikkaus ei siis ole
leikkaus vaan pilviseinä jonka läpi lennetään ja josta tullaan ulos jossain
muualla. Kortit ovat **kameran omassa kehyksessä**, etäisyydet annettu per
maailma; näkymäavaruuden etäisyydet eivät tarvitse mittakaavan sovittelua, ja
mittakaavan sovittelu oli juuri se mikä edellisen version rikkoi.

Ja grade on kunkin maailman oma, johon tämä kohtaus **lisää** sen sijaan että
korvaisi: viidakon bloom on se mikä tekee pimeästä vihreästä huoneesta
luettavan, ja tulivuoren valotus on se mikä estää laavaa ylivalottumasta. Yksi
tasainen grade kaikille kolmelle on mahdoton — jompikumpi puhkeaa aina.

Tahdista 124 alkaa toinen, nopeampi kierros samojen kolmen paikan läpi, ja se
jatkaa siitä mihin ensimmäinen jäi: kolme kammiota kahdesti on rakenne, samat
kolme ottoa kahdesti on silmukka, ja silmukan silmä lukee virheeksi.

### Sivutuote: viidakon otoshetki

`worlds.js` otti viidakon tahdista 50, joka osuu S5:n ainoaan kohtaan jossa
ruudussa ei ole mitään — tummaan vihreään mössöön pitkospuiden ja
saniaisseinämän välissä. *Jokainen* kohtaus joka leikkaa "viidakkoon" leikkasi
siihen: S8, S13 ja S14. Nyt tahti 46, eli pitkospuut ja lyhty — se miltä viidakko
näyttää kun se näyttää itseltään. Sama vaihto korjaa S14:n viidakkoleikkauksen
ilman että siihen kosketaan erikseen.

(S5:n oma keskikohta on yhä mössöä — se on eri asia kuin mihin muut kohtaukset
leikkaavat, ja jää avoimeksi.)

### S13: kalansilmä ja iiris

> "Nyt näytti ihan hyvältä. Toimisiko muuten semmoinen että laitetaan
> kalansilmäefekti näillä yhdistetyille ruuduille ja siirtymä tulisi sitä
> kautta että sumu tulee reunulle kuin iiriksenä? Vähän kuin silmä
> räpsähtäisi."

Toimii, ja se tekee kammioista yhden asian kahdella tavalla.

**Linssi** on uusi `uFish` kompositorissa: koko ruutu luetaan uudelleen niin
että siirtymää **pienennetään** säteen mukana, jolloin kohdereuna lukee lähteen
sisältä eikä mitään haeta ruudun ulkopuolelta — reunoille ei siis tule
venytettyä rajaa. Hinta on alkuperäisen kulmat, mikä on juuri se mitä
kalansilmä muutenkin maksaa. Kuvasuhdekorjattu, tai pullistuma on ellipsi.
Nollana oletuksena ja nollattuna joka ruudulla `Post.reset()`:ssä, joten linssiä
pyytävä kohtaus pyytää sen eikä yksikään kohtaus peri sitä. Ja se on nimenomaan
resample kompositorissa eikä geometrian vääristys: kalansilmä josta sumukortti
tai taivaskupu ei tietäisi olisi se yksi litteä asia taivutetussa kuvassa.

**Iiris** oli jo puoliksi valmis rakenteessa: sumukortit ovat kameran omassa
kehyksessä, joten niiden **ruutupaikka** on saatavilla varjostimessa, ja siirtymä
portitetaan sillä eikä millään maailmassa olevalla. Sumu työnnetään ulos
ympyrästä jonka säde sulkeutuu — pilvi tulee kulmista sisään ja menee kiinni
kuin luomi — ja reuna on pehmeä ja repaleinen koska korttien oma kohina kertoo
sen yhä, mikä pitää sen sulkeutuvana sumuna eikä pyyhkäisynä.

Räpäytyksen muoto on sama kolme lukua joilla S9:n hahmot räpäyttävät: **kiinni
nopeammin kuin auki, ja hetki kiinni**. Maailma vaihdetaan luomen ollessa alhaalla.
Ja linssi taipuu voimakkaammin kun luomi tulee, mikä on se mitä silmä tekee
kuvalle sulkeutuessaan.

Sivuvaikutuksena kohtaus myös **alkaa ja loppuu** räpäytykseen: ensimmäisen
kammion alussa iiris on kiinni ja aukeaa neulanreiästä, ja viimeisen lopussa se
sulkeutuu saarikentän ympärille — sisään- ja ulostulo ilman erillistä leikkausta.

### S12 "Void": tyhjä, mutta tilavuutena eikä tyhjänä ruutuna

Katselmuksen toinen löydös oli osin oma virhearvioni: kolmen otoksen perusteella
kohtaus näytti piirteettömältä sumulta, mutta kolme välähdystä ovat kyllä
paikallaan ja toimivat — viidakko, tunneli ja aavikko, kukin **kaksi ruutua**
mitatuilla huudoilla (191.80, 192.23, 192.65 s). Osuin näytteilläni pelkkään
tyhjään väliin. Kohtaus on tarkoituksella yksitoista sekuntia tyhjää ja kolme
33 millisekunnin vilausta sen keskellä, eikä siihen ole syytä koskea.

Mitattavissa oleva vika oli silti olemassa, ja se oli **taajuudessa**. Hallitseva
kohinakerros oli 1.15 suuntayksikköä kohti: kuudenkymmenenkahden asteen näkymä
kattaa siitä noin yhden solun, joten mitä tahansa kerros tekikin, kuva oli yksi
litteä näyte siitä. Mitattuna kohtauksen sisäinen kontrasti oli keskihajonta 8.6
(255:stä) ja kaksi neljän sekunnin päässä toisistaan olevaa ruutua erosivat 5.8
missä kahden sekunnin päässä olevat erosivat 5.0 — se ei ole kehittyvä kenttä
vaan rae jonka alla on aavistus ajautumista. Mikään briefissä ei pyydä sitä; se
pyytää ettei ole horisonttia eikä suuntaa, ja tyhjyydessä jossa on säätä ei ole
kumpaakaan.

Taajuudet nostettiin niin että ruudun poikki on useita soluja, ja **ajautumis-
kertoimet nostettiin niiden mukana**: kuvio liikkuu churn/taajuus verran
suuntayksikköinä, joten molempien skaalaaminen jättää näennäisen nopeuden
täsmälleen sinne mihin se oli viritetty ja lisää vain rakennetta jolle tapahtua.

Ja se paljasti heti toisen vian. **Kaksiulotteinen kohina suunnan kahdesta
komponentista** — `fbm(dir.xz)` — antaa jokaiselle pisteelle saman arvon kuin
sen peilikuvalle puuttuvan komponentin tason läpi: kenttä on peilattu ylhäältä
alas, ja peilin akseli on **viiva ruudun poikki**. Se on horisontti, eli
täsmälleen se mitä tämä kohtaus ei saa sisältää. Se oli näkymätön niin kauan kuin
piirteet olivat ruutua suurempia, ja näkyi saumana ensimmäisessä renderissä
taajuuden noston jälkeen. Nyt kohina on **triplanaarista** — kolme
2D-näytettä sekoitettuna suunnan omilla komponenteilla — jolla ei ole
symmetriatasoa missään pallolla. Mitattu: pystypeilauksen korrelaatio 0.09.

Lopputulos: keskihajonta 8.6 → 9.9, ja kolmen sekunnin päässä olevat ruudut
eroavat 5.0 → 9.7. Kenttä kääntyy paikallaan eikä kulje mihinkään.

### S12: enemmän välähdyksiä, ja maailmat sumun sisällä

> "Tuossa S12 ehkä vois olla enemmän noita väläyksiä. Nyt scene on vähän tylsä.
> Ja voisiko tuohon savuun jotenkin saada ääriviivoina tai varjoina noita
> aavikkoa/islandeja/metsää? Jotenkin että saisi dynaamisemmaksi tuon S12:n."

**Kolme välähdystä → kaksitoista.** Kolme vilausta keskellä ja ei mitään
kummallakaan puolella oli puolustettavissa rakenteena eikä kestänyt katsomista:
yksitoista sekuntia on pitkä aika pitää harmaata. Kolme huutoa pitävät paikkansa
ja painonsa — ne ovat yhä ainoat jotka sääntöjen mukaan saavat osua tahdin
sisään, ja ne kulkevat yhä vihreä, sinivalkoinen, meripihka siinä järjestyksessä
— ja niiden ympärillä tyhjyys puhkaistaan **iskuilla**, kiihtyen kohti huutoja ja
hiipuen niiden jälkeen. Vahvoille kaksi ruutua, heikoille yksi: yksi ruutu ei ole
puoli vilausta vaan eri asia, lähempänä jotain joka jää silmäkulmaan, ja se ero
on suurin osa siitä mikä tekee sarjasta intensiteetin eikä metronomin.

**Ja sumu pitää maailmoja sisällään.** Viidakko, aavikko ja saaret valokuvataan
kukin **kerran** pieneen renderöintikohteeseen — oma kohtaus, oma kamera, samalla
kiinteällä hetkellä jota niiden välähdys käyttää — ja kupu piirtää niistä ei
kuvaa vaan sen **paikallisen kontrastin**. Valokuva sumussa on valokuva sumussa;
sen ääriviiva on jotain puoliksi nähtyä, ja siinä on koko ero.

Kolme asiaa piti mitata eikä arvata, ja jokainen niistä meni ensin väärin:

* **Kaksi mittakaavaa, ei yhtä.** Hieno paikalliskontrasti löytää reunat, ja
  pelkät reunat ovat hiusviivoja — tällä peittävyydellä ne lukevat naarmuina
  sumussa. Karkea löytää **massat**: harjanteen taivasta vasten, saaren
  avaruutta vasten. Ne ovat ne muodot jotka katsoja osaa nimetä.
* **Suunta kameran kehyksessä, ei maailman.** Tämä kamera putoaa, eli se katsoo
  lähes suoraan **alas**, ja maailmansuuntien atsimuutille ja korkeuskulmalle
  ladottu maailma jää kokonaan oman valokuvansa reunan ulkopuolelle. Ensimmäinen
  versio piirsi taivaalle vain kiinnileikatun reunapikselin.
* **Skaalat frustumista.** Kuudenkymmenenkahden asteen pystykenttä kattaa ±0.54
  radiaania korkeuskulmaa ja 16:9:llä ±0.81 atsimuuttia; niiden kuvaaminen
  valokuvan nollasta yhteen on yksi jakolasku kummallekin. Arvattuna ne jättivät
  suurimman osan ruudusta kuvan ulkopuolelle ja haamu palasi **kaistana ruudun
  keskellä leikatuin reunoin** — se on se miltä tekstuuri näyttää kun sen
  loppu on ohitettu.

Kunkin maailman ääriviiva nousee **oman välähdyksensä jälkeen** ja haipuu parissa
sekunnissa, sen päällä hidas peruskaari joka tuo kunkin vuorollaan esiin. Se
jälkimmäinen on se mikä saa kohtauksen tuntumaan aiheutetulta eikä aikataulutetulta:
se mikä puhkaisi tyhjyyden hetki sitten on se mitä tyhjyys yhä pitelee.

### S8, S10 ja kolme muuta: välähdys ei voi alkaa ennen omaa vihjettään

Katselmuksen kolmas löydös ("pestyt vaaleat käytäväruudut") osoittautui kahdeksi
eri asiaksi, joista toinen oli oikeasti vika.

**S8 oli kunnossa** — sen jälkikuva on jo kausaalinen ja lyhyt (0.35 s), ja
viisi ovea viidessä sekunnissa tarkoittaa että kolmesta näytteestä kaksi osui
jälkikuvaan. Sama näytteenottoharha kuin S12:ssa.

**S10 ei ollut.** Sen isku oli `exp(-|t - vihje|*k)` — **symmetrinen**, eli kuva
alkoi pestä itseään puoli sekuntia *ennen* huutoa johon se on reaktio. Silmä on
ehtinyt sopeutua siihen mennessä kun ääni tulee, ja se mikä oli tarkoitettu
iskuksi lukee pitkänä maitomaisena paisuntana jonka keskellä on jossain vihje.
Mitattuna S10:n kolmannessa huudossa ruudun viides persentiili kulki 29:stä
146:een kokonaisen sekunnin rampin aikana; nyt mitään ei tapahdu ennen vihjettä,
huippu on 0.1 s sen jälkeen ja 0.5 s myöhemmin ollaan takaisin tummassa.

Sama muoto oli kirjoitettuna **viiteen kohtaukseen**, joten korjaus on
`Timeline.hit()` eikä viisi paikallista korjausta: ei mitään ennen vihjettä,
kahden ruudun nousuaika jottei alku ole napsahdus, ja sama vaimennus joka sillä
aina oli. Käyttäjät: S6 ("Keep moving." -pulssi), S10, S11 (Go!/Woo — pehmeämpi
nousu, ne ovat paisuntoja pitkän nuotin alla eivätkä iskuja), S15 ja S16.

### S5:n keskikohta: viisitoista metriä, ei kolmekymmentä

Katselmuksen neljäs löydös piti paikkansa. S5:n keskiosa — tahdit 50–58, eli
kolmannes kohtauksesta — mitattiin keskihajonnalla 6.4 (255:stä) siinä missä sen
avaus on 23:ssa: ruudussa ei ollut mitään katsottavaa.

Syy oli kameran korkeus. Latvustonousu meni **kolmeenkymmeneen metriin** ja
katsoi sieltä alas, ja siltä korkeudelta pitkospuut ovat neljä pikseliä leveät,
soihdut kaksi, ja väliin jäävä latvusto peittää suurimman osan niistäkin.
Kohtauksen oma muistiinpano kertoo mitä sieltä ylhäältä pitäisi nähdä — "the
walkway and the torches on it getting smaller" — ja juuri se ei näkynyt.
Viidessätoista metrissä kansi on yhä viiva jolla on valot, ja se on se otos.

Ja **ilma ohenee korkeuden mukana**. Sumu on täällä pelkkä etäisyystermi jolla
on yksi tiheys koko maailmalle: oikein pään korkeudella märässä metsässä ja
väärin latvuston yläpuolella, koska usva makaa alhaalla. Kaksikymmentäviisi
metriä ylhäältä yhden tiheyden läpi alas katsottuna pitkospuiden tilalla on
litteä vihreä seinä. `jungle.update()` ottaa nyt kutsujalta tiedon siitä kuinka
sakeaa ilma on siellä missä kamera on.

Keskihajonta 6.4 → 9.4–10.2 koko keskiosan yli, ja tärkeämpänä: ruudussa on nyt
johtava viiva joka osoittaa valoon.

### S9: sekin oli näytteenottoharha

Kolmas kerta samalle virheelle, ja kirjaan sen siksi että se on selvästi tämän
katselmuksen oma sokea piste. S9 mitattiin lähes mustaksi (keskiarvo 15.8,
keskihajonta 2.5) kolmesta otoksesta — mutta kohtauksessa on **strobo kerran
tahdissa**, ja tiheämmin näytteistettynä (kaksitoista ruutua yhden tahdin yli)
yksi niistä on keskiarvo 24.7 ja 99. persentiili 61: täysi joukkokuva, hahmot,
asennot, hehkuvat silmät. Kaikki kolme alkuperäistä otostani osuivat strobojen
väliin.

Ja se väli on oma kuvansa eikä vika: pimeässä näkyvät vain silmät, joten
joukon paikantaa vain niistä. Kohtaus tekee mitä sen on tarkoitus tehdä.

*(Yksi asia jonka voisi vielä tehdä, jos haluat: silmien hehku strobojen
VÄLILLÄ on 8 prosentissa, ja sen nostaminen vahvistaisi "vain silmät"
-kuvaa koskematta stroboon. Jätin tekemättä koska hyväksyit S9:n sellaisena.)*

### S5: soihdut saivat kepin

> "Korjataan nyt samalla S05 soihdut. Ne leijuvat ilmassa, niihin voisi ihan
> vaan laittaa mustat tikut maahan asti niin ne näyttävät soihduilta."

Soihtu oli lisäävä liekkibillboard kahden ja puolen metrin korkeudessa eikä sen
alla ollut mitään. Nyt jokaisella on **paalu maahan asti**: yksi laatikko,
kallistettuna vähän kummallekin puolelle, ja upotettuna maahan eikä sen päälle
— pinnalla lepäävä pylväs lukee sinne asetettuna rekvisiittana, sama asia jonka
saarten lohkareet tarvitsivat.

Yksi asia meni ensin väärin ja on kirjaamisen arvoinen: paalu tehtiin aluksi
**kävelysillan omalla puumateriaalilla**, ja liekin alla suoraan seisova paalu
saa täyden soihtuvalotermin. Kaiteille viritettynä se palautti kirkkaan
keltaisen pylvään jonka päällä on valo — eli **lyhtypylvään**, ei soihdun.
Tummempi puu ja viidesosa vasteesta panee sen takaisin siksi mitä se on:
hiiltynyt keppi joka näkyy juuri ja juuri oman liekkinsä alta. Kaikki muu —
sumu, ilman väri, ekstinktio — on sama kuin kannella, koska ne ovat maailman
ominaisuuksia eivätkä esineen.

### S11: putouksen tukos, kaksi löydettyä syytä ja yksi avoin

Palasin siihen tukokseen jonka jätit myöhemmäksi. Kaksi mitattavaa syytä löytyi
ja korjattiin; kolmas jää auki, ja kirjaan senkin mitattuna eikä arvattuna.

**Putous hyppäsi heti huulelta sivuun.** Siluettitaulukkoa luetaan ikkunalla —
useita suuntia ja korkeuskaistoja kerrallaan — koska se täytetään kärjistä ja
solu voi olla tyhjä siellä missä kivi on vain harvaan näytteistetty; jokaisen
virheen on oltava ulospäin. Huulella se turva maksaa enemmän kuin tuottaa:
ikkuna ulottuu seitsemäntoista astetta reunaa pitkin ja kaksi kaistaa alas
hartiaan, ja reunan säde vaihtelee enemmän kuin sen verran tuolla matkalla.
Niinpä jokaisen putouksen **ensimmäinen** asema työnnettiin naapurustonsa
leveimpään kiveen — mitattuna seitsemänkymmentä yksikköä huulen ohi suurimmalla
saarella — ja vesi lähti joesta sivuhypyllä. Kannelta katsottuna se lukee
tukoksena. Huuli on se yksi korkeus jolla kiven säde ei ole arvaus: se on
kävelty verkosta. Veto liukuu nyt sisään samalla kymmenesosalla pudotusta kuin
kaari, ja sen ikkuna levenee matkan varrella — kapea siellä missä vastaus
tiedetään, leveä siellä missä ei.

**Ja taulukossa on reikiä juuri siellä missä jyrkänne on.** Kaista on
seitsemäskymmenesosa saaren korkeudesta, ja siellä missä pinta on seinä, kärjet
ohittavat useita kaistoja kerralla ja jättävät kokonaisia soluja tyhjiksi.
Tyhjä solu lukee "ei kiveä tässä" — eli putoukselle kerrottiin että sillä on
tilaa keskellä jyrkännettä. Reiät täytetään nyt kunkin suunnan ylimmän ja
alimman osuman **välillä**: sen sisällä reikä on näytteenoton puute ja kivi on
varmasti siellä, sen ulkopuolella ei ole mitään mitä väistää.

**Ja se kolmas kaivettiin loppuun asti.** Kohdassa t≈177 neljännes putouksesta
oli piilossa. Ratkaiseva testi oli yksi rivi: `depthTest: false` putouksen
materiaaliin, jolloin piilossa oleva osuus meni **nollaan** — eli kyse on
aidosta syvyyspeitosta, jokin on veden edessä, eikä esimerkiksi ilmakehän
himmennyksestä.

Kaksi työkaluvikaa kävi ilmi matkalla, ja ne ovat se osa tästä joka kannattaa
muistaa:

* **`debugLayers()` ei listannut `scrub`- eikä `gas`-kerrosta.** Ne on lisätty
  myöhemmin eikä listaa päivitetty, joten `--mute scrub` ei vaimentanut mitään
  ja raportoi silti onnistuneensa — mikä lukee täsmälleen kuin "ei tämä
  kerros". Kolmekymmentäkahdeksantuhatta läpinäkymätöntä instanssia joita ei voi
  sammuttaa on kolmekymmentäkahdeksantuhatta instanssia joita ei voi sulkea
  pois. Kerros jota ei voi soloida on kerros jota ei voi debugata.
* **`__mute` otti vain yhden nimen.** Yksi kerros kerrallaan vastaa kysymykseen
  "onko tämä kerros ainoa asia tuon edessä" eikä mihinkään muuhun — ja kun kaksi
  kerrosta peittää samat pikselit, jokainen yhden kerroksen testi palaa
  kieltävänä ja johtopäätös on että kumpikaan ei ole syyllinen. Nyt se ottaa
  listan, ja `bodies,scrub,debris` yhdessä vei piilossa olevan osuuden 26
  prosentista kahteen.

Vastaus itse: **muut kappaleet katselinjalla**. Lähempänä oleva saari nousee
putouksen alaosan eteen ja oman saaren hylly leikkaa sen yläosan; pieni
kelluva kivi käy myös edessä. Vesi ei siis mene kiven sisään — mitattuna sen
etäisyys kallioon on 14–40 yksikköä joka putouksella — vaan sen ja kameran
välissä on kiveä. Se on tavallista parallaksia eikä korjattavissa oleva vika.

Yksi luokka siitä oli kuitenkin oikea vika ja korjattiin: **sirpale joka on
pysäköity putouksen sisään**. Putousten pylväät tunnetaan (`measureCourses()` on
jo kävellyt jokaisen huulen ja pudotuksen pituuden verkosta), joten `C.outR`
lasketaan nyt siellä — yhdessä paikassa, koska kahdesti laskettu luku on luku
joka joskus eroaa itsestään — ja `buildDebris()` työntää sirpaleen ulos
pylväästä säteittäisesti, samalla tavalla kuin päällekkäiset saaret erotetaan.

### S7 "Volcanic": savu oli valokuva

Viimeinen katselmuksen avoin kohta. Ohje oli *"parannellaan myöhemmin
tulivuoria jos tarvii"*, joten kysymys oli mitattava eikä maun asia: mikä
tässä kohtauksessa on **rikki**, ei mikä siinä voisi olla toisin.

Vastaus oli yksi asia ja se on iso: **savupatsaat eivät liikkuneet lainkaan.**
`buildColumns()` sävelsi jokaisen pöllähdyksen paikan instanssimatriisiin
kerran, rakennusvaiheessa, eikä koskenut siihen enää. `uTime` pääsi savuun
täsmälleen yhdestä kohdasta — kohinakentän vieritys 0.06 kentässä jota
näytteistetään 3.2 sykliä per pöllähdys, eli **kaksi sadasosaa pöllähdyksen
leveydestä sekunnissa.** Patsas oli valokuva.

Tämä on täsmälleen sama vika kuin S11:n "joet eivät virtaa", ja se on
piiloutunut samasta syystä: kohtauksen ensimmäinen otos **kiertää** sankarivuorta,
joten patsas liikkuu ruudussa koko ajan. Parallaksi ei kuitenkaan ole virtausta.
Jäykkänä kappaleena lasin ohi liukuva patsas lukee tehdaspiippuna.

Mitattuna, ristikorrelaationa taivasalueesta kahden ruudun välillä:

| | siirtymä | |
|---|---|---|
| **ennen**, 0.5 s | dx −2 px, dy **+2 px** | ei mitään, ja sekin alaspäin |
| **jälkeen**, 0.3 s | dx +8 px, dy **−16 px** | savu nousee |

Korjaus on se sama kuvio jota `buildEmbers()` on aina käyttänyt tässä samassa
tiedostossa — ja juuri siksi kipinöillä ei ole koskaan ollut tätä vikaa:
instanssimatriisi on **identiteetti** eikä kanna mitään, ja pöllähdyksen koko
tila on suljettu muoto attribuuteista ja `uTime`:sta laskettuna
vertex-varjostimessa. `age = fract(vaihe + t/elinikä)`, joten mikään ei
integroidu ja jokainen ruutu seisoo yhä yksinään. Puhtaus tarkistettu:
sama ruutu kahdesta eri selainistunnosta on tavulleen identtinen.

Patsaan **muoto** ei muuttunut, ja se on tarkoitus: vaiheet on jaettu tasan
(`i/PUFFS`) ja saman patsaan pöllähdykset jakavat eliniän, joten milloin
tahansa läsnä olevien ikien joukko on sama ruudukko kuin ennen, vain
siirrettynä. Hyväksytty silhuetti säilyy; vain savu sen sisällä liikkuu.

Kaksi asiaa muuttui tarkoituksella:

* **Kalteva → kaartuva.** Vanha `lean` oli patsaskohtainen satunnaisluku ja
  lineaarinen korkeudessa, eli suora vino putki. Nyt leikkaus on
  ylilineaarinen (`pow(f, 1.55)`) ja **koko maailmalla on yksi tuuli**. Kolme
  samaan suuntaan kaartuvaa patsasta lukee säänä yhden maiseman yllä; kolme eri
  suuntaan kallistuvaa lukee kolmena piippuna.
* **Häviää yläpäästä nollaan.** Vanha peitto päättyi kolmasosaan
  alkutiheydestään. Paikallaan pysyvällä patsaalla se ei näkynyt; kierrätetyllä
  se olisi poksahdus — leveä haalea pöllähdys katoaa katosta ja ilmestyy
  kraatteriin. Eksponentti on valittu niin että käyrä on prosentin sisällä
  hyväksytystä kolme neljäsosaa noususta ja vasta sitten menee nollaan.

Loput kohtauksesta on ehjä eikä siihen koskettu. Yksi asia jää merkinnäksi
eikä ole vika: **sankarivuoren valaistu rinne lukee hieman kankaana** —
laavauomien juovitus on säännöllistä ja huipulle suppenevaa, mikä antaa
lampunvarjostimen vaikutelman. Se on tyylikysymys, ei rikkinäisyys, joten sitä
ei muutettu kysymättä.

### S7, toinen kierros: pinta oli tekstuuria

> "Tulivuoriskenessä tulivuoren pinnat on tekstuuria, ja lopussa kun lennetään
> kohti tulivuorta huomaa että ei ole oikeita jäähtyneen laavan muotoja."

Oikeassa, ja lähdekoodi myöntää sen omin sanoin: *"Rock texture as a normal
perturbation rather than as geometry."* Kaikki mitä tässä maailmassa luki
muotona alle noin kahdensadan yksikön oli normaalin kertoma valhe. Todiste on
joka ruudussa: **maan siluetti taivasta vasten on puhdas sileä käyrä**, mitä
yksikään laavakenttä ei ole. Siluetti on ainoa paikka jossa pinta ei voi
valehdella muotoaan.

Yhden valituksen alla oli kaksi eri vikaa, ja ne tarvitsivat eri korjaukset.

**1. Morfologiaa ei ollut millään mittakaavalla.** `volcBase()`:n hienoin
oktaavi on 160 yksikön aallonpituus kahdeksan yksikön amplitudilla; sen alla
kenttä on kirjaimellisesti sileä. Jopa 19 yksikön hila olisi voinut kantaa
laavalohkoja ja painekaarteita koko ajan — niitä ei vain ollut olemassa.
Lisätty `LAVA_GLSL`, ja muodot on valittu siitä mitä tämä maailma **saa**
olla: ohje kieltää ihmismittakaavan, joten köydet ja klinkkeri ovat poissa
(ne ovat desimetrejä, ja desimetri on koko jonka ihminen tuntee). Nämä ovat
kymmeniä metrejä, mikä on maisemaa eikä huonekaluja:

* **`lobeField()` — inflaatiolohkot ja varpaat.** Lohko on *tasalakinen*
  laatta jolla on jyrkkä rintama, ja lohkot **menevät päällekkäin**: nuorempi
  makaa vanhemman päällä eikä sekoitu siihen. Siksi tämä on maksimi
  pyöristetyistä tasanteista eikä summa kumpareista, ja se yksi valinta on
  suurin osa siitä mikä erottaa laavan mäistä — mäet summautuvat, virtaukset
  pinoutuvat.
* **`ridgeTrain()` — painekaarteet**, jotka syntyvät **poikittain**
  kulkusuuntaan nähden kun jähmettynyttä kuorta työnnetään takaa.
* **ja sauma joka leikkaa**, ei vain hehku. Kuori joka on revennyt on urassa;
  tämän maailman halkeamat olivat valoa maalattuna lattiaan.

**2. Eikä resoluutiota linssin lähellä.** Kamera lopettaa oton 95 yksikköä
maan yllä; sen alla verkon pisteet ovat 19 yksikön päässä toisistaan. Se on
kourallinen kolmioita koko etualalla — vaikka kentässä olisi ollut yksityis-
kohtaa, verkko ei olisi voinut näyttää sitä. Uusi `buildDetail()`: 3000
yksikköä leveä, 440 ruutua, eli **6.8 yksikön hila**, kahdeksasosa karkean
verkon soluala viidesosalla sen kärkimäärästä, koska se kattaa vain sen maan
jonka lähellä oikeasti ollaan. Se ratsastaa kameran alla **omaan hilaansa
napsautettuna** — sama syy jonka desert.js kirjaa pitkästi.

Verkot eivät koskaan tappele samasta pikselistä: karkea **hylkää** fragmentit
1250 yksikön sisällä (`HOLE_R`), tarkka ulottuu 1500:aan pahimmassakin
napsautusvaiheessa, ja hieno morfologia on jo nollassa 1150:ssä. Päällekkäisen
vyöhykkeen sisällä molemmat laskevat **saman lausekkeen**, termi termiltä —
siksi sauma ei ole sauma. Materiaali rakennetaan yhdestä funktiosta
(`groundMaterial()`), ei kahdesta kopiosta: kaksi varjostinlähdettä joiden on
tarkoitus olla samat ovat kaksi varjostinlähdettä jotka eivät pysy samoina.

Isot muodot ovat **kaikkialla**, eivät vain kameran lähellä — juuri siksi että
valitus on siluetista, ja siluetti on määritelmällisesti kaukana. Pelkkä
lähipaikkaus olisi vastannut etualaan ja jättänyt joka taivaanrannan sileäksi
kaareksi.

#### Ja kaksi kertaa väärin ennen kuin oikein, samasta syystä

Ensimmäiset kaksi yritystä palauttivat **piikkimaton** — rypistettyä folioita,
piikkejä kolmion kokoisina, riippumatta siitä mitä parametreihin kirjoitti.
Syy oli koordinaatistossa:

```
vec2 q = vec2(dot(p, d), dot(p, perp(d)));   // d = d(p)
```

Tämä *ei ole kierto*. Paikkariippuvaisen kulman kierron Jacobiaani on
`I + p·(∂d/∂p)`, ja jälkimmäinen termi kasvaa etäisyyden mukana origosta
rajatta. Kolmen tuhannen yksikön päässä, suuntakentällä joka kääntyy noin
sadasosaradiaanin verran yksikköä kohti, kerroin on **kolmekymmentä** — eli
jokainen "240 yksikön lohko" oli oikeasti kahdeksan yksikön lohko, mikä on
tuskin yksi kolmio.

Se on täsmälleen sama vika kuin vesiputousten `phase = y − t·rate(y)`,
**tilassa ajan sijaan**: koordinaatin kertominen jollain joka vaihtelee sen
koordinaatin yli kertoo taajuuden derivaatalla. Korjaus on **rajattu
domain-warp** kierron sijaan (`lavaFrame()`): kuvio on kiinni maailmassa ja
sitä taivutetaan siirtymällä jonka oma gradientti on murto-osa ykkösestä.
Sama keino jota `crackGlow()` jo käyttää soluihinsa.

Toinen näytteenoton ehto meni myös kirjaan: **lohkon rintaman leveys valitaan
verkosta, ei valokuvasta.** Laavarintama on todellisuudessa lähes pystysuora;
6.8 yksikön hilalle piirrettynä 30 yksikköä on neljä kärkeä ja lukee
rintamana, 19 yksikön hilalle se on puolitoista — ja puolitoista kärkeä
pystysuoraa pudotusta on piikki. Siksi `lavaFront()` **aukeaa etäisyyden
mukana**, täsmälleen sitä samaa ramppia pitkin jota hieno yksityiskohta
häipyy, ja koska molemmat verkot laskevat saman lausekkeen ne ovat yhä yksi
sama pinta. 62 yksikköä pehmeyttä 1200 yksikön päässä on kolmasosa pikselistä.

#### Työkalu

`stills.mjs` **kertoo nyt miksi sivu ei latautunut.** Syntaksivirhe missä
tahansa moduulipuussa — harhainen backtick GLSL-kommentissa on tehnyt tämän
nyt kahdesti — tarkoittaa ettei `main.js` koskaan aja, `__ready` ei koskaan
asetu, ja ainoa mitä skripti tulosti oli `Timeout 60000ms exceeded` tyhjällä
lokilla. Se on työkalu joka raportoi että jokin on vialla ja pidättää sen
yhden rivin joka kertoo mikä. Sivun virheet olivat koko ajan olemassa; nyt ne
tulostetaan.

#### Hinta ja tarkistukset

Kärkiä on nyt 385k + 195k. SwiftShaderilla (ohjelmistorasterointi, vain omaa
tarkistustani varten) ruutu meni 7.4 sekunnista 14:ään; oikealla näytön-
ohjaimella tämä on eri kokoluokan kysymys. Puhtaus tarkistettu: sama ruutu
kahdesta eri selainistunnosta on tavulleen identtinen. `--mute detail`
paljastaa reiän puhtaana ympyränä ja loput ruudusta muuttumattomana, eli
karkea verkko kantaa isot muodot ja tarkka verkko lisää vain lähikentän.

Etualan kirkkaus ei liikkunut: 0.212 → 0.205.

### S8 / S10 / S15: "pestyt vaaleat käytäväruudut" — löytyi vihdoin syy

Listan viimeinen avoin kohta oli oma havaintoni *"S8:n käytävä on kirkkaampi
kuin muiden tunneliscenejen."* Mitattuna se ei pidä paikkaansa siinä muodossa,
ja se mitä sen tilalta löytyi on paljon pahempi.

Viisi TRANSIT-kohtausta, neljä ruutua kummastakin, keskikirkkaus:

| | S4 | S6 | **S8** | S10 | S15 |
|---|---|---|---|---|---|
| keskiarvo | 0.161 | 0.088 | **0.159** | 0.089 | 0.092 |

S8:n luku on kuitenkin kahden mustan (0.069) ja kahden vaalean (0.245, 0.252)
ruudun keskiarvo, eikä käytävä ole tasaisesti kirkkaampi. Vaaleissa ruuduissa
5. ja 95. persentiili ovat 0.203 ja 0.274 — **kuvassa ei ole rakennetta
lainkaan.** Se ei ole kirkas käytävä, se on **harmaa kortti** jonka sisällä
kalvo näkyy heikosti.

Syy on yhdellä rivillä `core/post.js`:ssä:

```glsl
col += uFlash;
```

`uFlash` on **litteä vakio joka lisätään jokaiseen pikseliin** — ennen
valotusta, ennen sävykartoitusta ja ennen gammaa. Käytävällä joka on lähes
musta se ei kirkasta mitään; se korvaa kuvan.

Ja se on aritmetiikkaa, ei vaikutelma. S8:n `after`-arvolla 0.267 litteä termi
on `0.18·0.267 = 0.048`; kohtauksen oman valotuksen, liftin, ACES-käyrän ja
1/2.2:n läpi se on **0.2425**, ja noiden ruutujen mitattu keskiarvo on 0.245.
S10:llä 0.26 ennustaa 0.684 ja ruutu kohdassa 151.37 mittaa 0.683.

**S8.** Kohtauksen oma kommentti sanoo *"the corridor darkens after each
door"* — ja koodi nosti kaikkia kolmea: valotusta, bloomia ja flashia. Kommentti
sanoi tummenee, koodi kirkasti. Nyt jälkikuva on se mitä jälkikuva on: silmän
herkkyys putoaa (**valotus alas** ja palautuu) ja häikäisseen kohteen hehku
jää (**bloom ylös**, joka voi kirkastaa vain pikselin jossa jo on jotain).
Litteä termi nollaan. Viisi ovea × 0.35 s = **1.75 sekuntia viiden sekunnin
kohtauksesta oli harmaa kortti**, eli 35 %.

**S10.** Sama vika ja pahempi: 0.26 kolmella huudolla, eli kolme ruutua joissa
koko kuva on tasaisen vaalea (keskiarvo 0.60–0.68, persentiilit 14 % päässä
toisistaan). Sama korjaus.

**S15.** Sama mekanismi 0.30:llä yhdellä kuulla joka on leikkauksessa S14:stä.
Välähdys leikkauksessa on siirtymä eikä vahinko, mutta siirtymä joka pyyhkii
käytävän on siirtymä ei-mihinkään. Nyt soihtu renkaissa.

**Eikä pieneksi vaan nollaan**, ja tämä on se osa joka kannattaa muistaa:
`uFlash`illa **ei ole pientä asetusta mustalla ruudulla.** Se lisätään
lineaarisessa valossa ja kompositi päättyy 1/2.2:een, joten gamma repäisee
alapään auki. Jätin sen ensin S10:een arvoon 0.05 "häivähdyksenä", ja ruudun
pohja oli yhä 0.287 koko kuvan yli. Muunnos:

| uFlash | 0.01 | 0.02 | 0.05 | 0.10 | 0.16 | 0.26 | 0.30 |
|---|---|---|---|---|---|---|---|
| taustan harmaa | 0.12 | 0.17 | 0.28 | 0.41 | 0.53 | 0.68 | 0.70 |

Korjauksen jälkeen, S10:n huudot: pohja 0.055 → **0.060** (eli ennallaan) ja
95. persentiili 0.137 → **0.233**. Kirkkaat kirkastuvat, musta pysyy mustana.
Kontrastisuhde huudolla oli ennen 1.14×, nyt 3.9×.

S17 oli kirjannut säännön jo kerran omaan kohtaansa — *"the light then comes
from somewhere rather than from everywhere"* — mutta sitä ei ollut viety
muualle. Nyt se on kirjattu S10:n viereen sen mittaustuloksineen.

#### Muut käyttäjät, mitattu mutta koskematta

Sama laskin kaikille kohtauksille jotka asettavat `uFlash`in. Osa on
tarkoituksellisia valkoisia — S4:n läpimeno (0.92), S5:n saapuminen (0.82),
S9:n salama (0.88), S16 joka on valkoinen määritelmällisesti. Nämä jäävät
merkinnäksi, koska ne ovat kohtauksissa jotka olet hyväksynyt enkä muuta niitä
kysymättä:

| | uFlash | taustan harmaa |
|---|---|---|
| S1 pulse | 0.16 | 0.53 |
| S6 keep | 0.30 | 0.70 |
| S11 lit | 0.10 | 0.41 |
| S12 after | 0.16 | 0.53 |
| S14 hit | 0.10 | 0.41 |

### Ja loput viisi: sama vika koko elokuvassa

Edellinen kierros jätti merkinnäksi viisi kohtausta joissa `uFlash` on litteä
harmaa pimeän kuvan päällä. Käytiin ne läpi. **Jokainen oli oikea vika**, ja
kaksi niistä kohtauksissa joita on hiottu eniten.

Mitattuna, mustan pohja (5. persentiili) ennen ja jälkeen:

| | hetki | ennen | jälkeen | puhdas ruutu samasta kohtauksesta |
|---|---|---|---|---|
| **S11** 'Everybody!' | 158.36 | **0.387** | 0.069 | 0.065 |
| S11, 1.5 s myöhemmin | 159.80 | 0.150 | 0.067 | 0.065 |
| **S12** jälkihehku | 191.90 | **0.504** | 0.388 | 0.243 |
| **S6** 'Keep moving.' | 115.14 | **0.659** | 0.068 | 0.059 |
| **S1** 'Hey!' | 20.30 | **0.803** | 0.086 | 0.072 |
| **S14** leikkauksessa | 238.05 | **0.344** | 0.076 | 0.071 |

Ja 95. persentiili nousee tai pysyy joka kerta — kirkkaat kirkastuvat, musta
pysyy mustana. S14:n leikkauksessa 0.486 → 0.334 kun leikkauksen välissä on
0.281, eli isku on yhä siellä; S11:n huudolla 0.222 (puhdas) → 0.277.

Pahin oli **S11**. `lit` vaimenee kuin `exp(-dt·1.15)`, joten litteä harmaa oli
0.39 huudolla ja **yhä 0.15 puolentoista sekunnin päästä** — pari sekuntia
elokuvan eniten työstettyä maailmaa valkoisen sumun takana, ja koko ajan
huudolla oli oikea lähde ruudussa: `islands.update()` valaisee yhden saaren
ilmakehän sisältä juuri tällä samalla luvulla. Valo siirrettiin sinne.

**S12**:n kohdalla vika oli väärä termi kahdesti: se vei pohjan 0.243:sta
0.504:ään ruudussa jossa on vain sumu ja maailmojen ääriviivat — ja se teki
sen **valkoisella**, laimentaen juuri sitä sävytettyä liftiä jonka on määrä
tehdä jälkihehkusta *"an afterimage of a place rather than a white blink"*.
Lift jäi, valkoinen lähti; väri jäi jäljelle.

**S6**:ssa 'Keep moving.' pyyhki käytävän kokonaan puoleksi sekunniksi
puhutulla sanalla. Kohtauksen *saapuminen* (0.55) on eri asia ja jäi
ennalleen: se nousee leikkaukseen ja kohtaa S4:n oman purskeen samassa
huipussa samalla hetkellä, yksi välähdys joka sattuu ylittämään
kohtausvaihdon — ruudun pyyhkiminen on sen tehtävä.

**S1**:ssä sama: 'Hey!' peitti veden alaisen pylvään valkoisella kortilla.
Pulssi on nyt **kerroin** valotuksessa, mikä on myös fyysisesti oikein — pylvästä
ylös kulkeva kirkastuminen kirkastaa pylvään ja valokeilat eikä mustaa vettä.
S1:n oma esipurske kohdassa T4 on tarkistettu ja ennallaan (0.849 / 0.791).

**S14**:ssä isku on nyt *gain* sen päälle mitä maailma juuri kirjoitti eikä
litteä lisä. Kommentin lupaus säilyy — kirkkain liitoksessa — mutta liitos on
nyt kirkas versio siitä paikasta eikä kalpea.

Neljä puhdasta ruutua (S1 15.0, S6 110.75, S11 165.0, S12 195.0) mitattiin
ennen ja jälkeen ja ne ovat kolmen desimaalin tarkkuudella samat, eli mikään
näistä ei koske hetkiin joissa välähdystä ei ole. Puhtaus tarkistettu, ja
`npm run check` sanoo yhä "page errors: (none)".

**Yhteensä tämä vika oli kahdeksassa kohtauksessa seitsemästätoista**: S1, S6,
S8, S10, S11, S12, S14, S15. Sen tunnistaa yhdestä asiasta ruudussa — kuva on
kauttaaltaan yhtä vaalea eikä siinä ole rakennetta — ja yhdestä asiasta
mittarissa: 95. ja 5. persentiili ovat lähellä toisiaan. Tarkoituksellisiksi
valkoisiksi jäivät S1:n esipurske, S4:n purske, S5:n saapuminen, S6:n
saapuminen, S9:n salama ja S16, joka on valkoinen määritelmällisesti.

## Koko elokuva mitattuna ruutu ruudulta

Katselmuslista oli tyhjä, joten ajoin koko elokuvan läpi ja mittasin jokaisen
ruudun sen sijaan että olisin katsonut kolmea per kohtaus — se menetelmä oli
väärässä kolmesti aiemmassa katselmuksessa. `render.mjs --w 400 --h 225
--fps 2 --png` antaa 589 ruutua koko elokuvasta noin viidessätoista
minuutissa, ja jokaisesta laskettiin keskiarvo, 5. ja 95. persentiili sekä
leikkautuneiden pikselien osuus. Kaksi oikeaa vikaa löytyi, kumpaakaan ei olisi
löytänyt katsomalla.

### 1. Elokuvan viimeinen sekunti oli valkoinen

Aikataulu kattaa tahdit 1–176, eli **0.752 – 292.415 s**, ja raita kestää
**293.407 s**. Niiden välissä on 0.99 sekuntia jota yksikään kohtaus ei omista.

`main.js`:n varasija oli `t >= tl.duration ? viimeinen : ensimmäinen`, ja
`tl.duration` on **raidan** kesto eikä viimeisen kohtauksen loppu. Joten tuon
sekunnin ajan `sceneAt()` palautti nullin, `t >= duration` oli epätosi, ja
elokuva leikkasi **kohtaukseen 1**. S1:n gradessa on
`preBurst = exp(-max(0, T4 - t)*16)` jossa T4 on 49 sekunnissa — mikä on
tasan 1 kaikilla myöhemmillä ajanhetkillä, mikä on `uFlash = 1.2`, mikä on
puhdas valkoinen.

Elokuva siis loppui: aavikko, häivytys mustaan, mustaa kaksi ja puoli
sekuntia — ja sitten **sekunti puhdasta valkoista**, keskiarvo 0.909, ennen
kuin ääni loppui. Mitattuna 10 ruutua sekunnissa: mustaa 292.4 asti, 0.909
kohdasta 292.5 loppuun.

Kaksi asiaa yhdessä, ja korjattiin se joka on oikeasti väärin. Muotoa
`exp(-max(0, cue - t)*k)` oleva termi on **1 kaikella ajalla kuun jälkeen** —
jokainen "nousee leikkaukseen" -välähdys tässä elokuvassa on kirjoitettu niin,
ja se on oikein sen kohtauksen sisällä joka sen omistaa. Väärin on
lähettäjä joka antaa kohtaukselle hetken kolme ja puoli minuuttia sen oman
lopun jälkeen. Nyt pitää **se kohtaus joka on viimeksi alkanut**, mikä sulkee
myös minkä tahansa aukon joka joskus syntyy kahden kohtauksen väliin — vanha
koodi olisi vastannut niihinkin elokuvan ensimmäisellä kohtauksella.

Tarkistettu: 291.5–293.4 on nyt joka ruudulla tasan 0.0000, myös maksimi.

### 2. S14 sammui joka kuudennella leikkauksella

**12 ruutua 54:stä oli litteän mustia** (keskiarvo 0.053, 95. persentiili
0.07). Arvot ovat käytännössä identtisiä, eli aina sama maailma.

Se on `dark`, ja syy on täsmälleen sama vika joka korjattiin kerran
viidakolle. `worlds.js` sanoo sen itse viidakon kohdalla: *"Bar 50 lands in
the one stretch of S5 that has nothing in frame... every scene that cuts to
'the jungle' was cutting to that."*

S9:n strobo on litteä 1 kahden ruudun ajan (`FLASH_S` = 0.033 s) joka iskun
jälkeen ja putoaa sitten lattiaan 0.03. Se on valaistu **kahdeksan prosenttia**
iskusta ja musta loput yhdeksänkymmentäkaksi. `at` oli jo tahtiviivalla eli
iskulla, joten vaihe 0 oli valaistu ja S8:n kolmas ovi näytti aina oikealta —
mutta `dur` oli **1.2 sekuntia**, ja S14 on ainoa kohtaus joka oikeasti
kävelee vaihetta. Se siis arpoi tasajakaumasta hetken kolmen iskun matkalta ja
osui pimeään lähes joka kerta. Yksi leikkaus kuudesta kuuden maailman
kastista — 54/6 = 9 odotusarvo, mitattu 12.

Montaasi jonka koko väite on *"no way to tell which world is the real one"*
sammui joka kuudennella leikkauksella.

Korjaus: `dur` on nyt **välähdys** eikä sekunti ja vähän (0.026), ja `at` on
nykäisty neljäsosaruudun verran iskun yli niin ettei pyöristys voi viedä
vaihetta 0 väärälle puolelle. Maailma tuskin liikkuu leikkauksen sisällä, mikä
ei ole kompromissi: tämä on se maailma jonka ohje sanoo että hahmot seisovat
pimeässä eivätkä liiku. **Nyt 0 ruutua 57:stä alle 0.07:n.**

### Mitattu, ei korjattu

* **S17** on 24 sekuntia tilastollisesti identtisiä ruutuja (keskiarvo
  0.56–0.58, persentiilit 0.38/0.874 muuttumattomina) ennen kuin myrsky
  saapuu kohdassa 283. Se on elokuvan pisin kohtaus ja loppukuva, joten
  paikallaan pysyminen on ilmeisesti tarkoitus — merkintänä vain.
* **S12** on koko elokuvan kolmanneksi kirkkain kohtaus (keskiarvo 0.335,
  vain S17 ja S16 yli). Kohtaus jonka nimi on "ei valoa" on harmaa eikä musta,
  mikä on tietoinen valinta ("a near-flat grey"), mutta se on nyt mitattu.
* Leikkautumista yli 2 % pikseleistä on S4:ssä, S14:ssä, S15:ssä ja S16:ssa —
  kaikki alle 5 % ja kaikki kirkkaita kohtia joissa on kuuma ydin. Ei toimia.

## Vesiosuus (S1–S3): kelluminen ja vedenpinta

> "Alussa oleva veden alla kelluminen on kyllästyttävää. Eli siihen pitäisi
> saada lisättyä jotain. Tai nopeutettua sitä. Ja ekan skenen vedenpinta
> näyttää teennäiseltä vieläkin, se paranee loppua kohti — mutta puolivälissä
> näyttää pahimmalta."

Vesiosuus on 49 sekuntia eli kuudesosa elokuvasta, ja mitattuna se oli
**38 sekuntia yhtä kuvaa**. Kolme eri syytä, ja kaksi niistä on sama vika:
kerros on rakennettu sinne minne kamera ei katso.

### Pohja oli olemassa mutta se ei näkynyt yhdessäkään ruudussa

`buildSeabed({ y: -1180 })`, kamera pohjimmillaan −636. Soloitettuna kaikki muu
vaimennettuna, kolmena hetkenä nousun varrella, kerros tuottaa **litteän 0.069
pesun maksimilla 0.094** — se on utuvakio, ei geometria. Kolmesataa lohkaretta
ja dyynitetty pohja rakennettiin joka kerta kun kohtaus ladattiin, eivätkä ne
näkyneet yhdessäkään elokuvan ruudussa. Sen oma kommentti sanoi että sen tehtävä
on *"that the picture has a far distance in it at all"*.

Ja se on samalla vastaus toiseen puoleen. Alku ei ole tylsä siksi että se on
hidas, vaan siksi että **hidas liike tyhjässä ruudussa ei ole liikettä
lainkaan**. Kamera avaa lähes vaakasuoraan (kallistus 1.36 rad pystystä, eli
60 asteen ruudun alareuna on 18 astetta horisontin alapuolella) eikä siellä
ollut mitään. Pohja on nyt **160 yksikköä linssin alla**, sijoitettuna nousun
lähtösyvyyteen suhteutettuna eikä kiinteään lukuun — juuri niin se aikanaan
karkasi viidensadan yksikön päähän. Nyt sama nousu alkaa dyyneillä ja
lohkareilla jotka valuvat ulos ruudun alareunasta, horisontilla johon perääntyä
ja mittakaavalla; ja **merenpohjasta irtoaminen on tapahtuma**, jollaista tässä
otoksessa ei ollut ennen tahtia 25.

### Nousu ei alkanut

`v = VEND·p^N`, N = 2.6. Mitattuna: **neljänkymmenenkahden sekunnin nousun
puolivälissä kamera oli tehnyt matkasta 8.3 %.** Se seisoi välillä y = −636 ja
−625 ensimmäiset kolmetoista sekuntia — yksitoista yksikköä kolmessatoista
sekunnissa.

Nyt `v = VEND·(V0F + (1−V0F)·p^N)`, V0F = 0.12, eli 6.6 yksikköä sekunnissa jo
ensimmäisessä ruudussa. Integraali on yhä alkeisfunktio, joten paikka ja nopeus
ovat edelleen suljettuja muotoja jotka eivät voi olla eri mieltä, ja **molemmat
reunaehdot pitävät yhä: v(1) = 55.0000 ja y(1) = 0.000000** — S4 ottaa kiinni
täsmälleen mistä S1 jättää. Puolivälissä tehty matka: **8.3 % → 22.0 %**.

### Ja hiutalepilvi roikkui kameran alapuolella

Sama vika kolmannen kerran samassa kohtauksessa. `buildWaterColumn()` latoo
hiutaleensa paikallisesta y = −2 alas −901:een; siirrettynä `y + 40` siitä oli
**38 yksikköä kameran yläpuolella ja 860 alapuolella**, ja tämä kamera katsoo
koko otoksen ajan ylös. Soloitettuna hetkellä t = 25: yhdeksäntuhatta hiutaletta
tuotti **kahdeksantoista pikseliä** yli puolitoistakertaisen taustan, yhdeksästä
sadastatuhannesta.

Ja juuri otoksen keskikohta maksaa siitä. Linssin ohi kulkeva hiutale on ainoa
parallaksi jota avovedessä on — siellä ei ole mitään muuta tunnetulla
etäisyydellä. Nyt pilvi on keskitetty **linssiin** (`y + 450`), ja tiheys ja
koko ovat argumentteja kutsupaikalla eivätkä vakioita: S1 pyytää 26 000
hiutaletta koossa 0.34, S4 pitää oletukset koska se kiitää kentän läpi ja sillä
on tunneli katsottavana. Mitattuna 0.002 % → **0.117 %**, eli 18 pikselistä
1078:aan.

### Vedenpinta oli tikattu peite

Sen tunnisti siitä että se oli **pahimmillaan puolivälissä** ja parani loppua
kohti: lähellä samat aallot vievät enemmän pikseleitä ja lukevat aaltoina,
keskietäisyydellä ne lukevat rakeena.

Syy on spektrissä. `WAVE_L0` oli 128 ja geometriaa kantavat komponentit 0–6,
eli aallonpituudet **128:sta 42:een — puolitoista oktaavia**, ja jyrkkyys on
suunnilleen vakio koko spektrin yli. Seitsemän yhtä jyrkkää aaltoa yhden ja
puolen oktaavin sisällä ei ole meri, se on ruutukangas: kaikki solut ovat
saman kokoisia eikä pinnassa ole hierarkiaa.

`WAVE_L0` = 340 vie geometrian **340:stä 112:een** ja jättää kaiken sen alle
fragmenttipuolen normaaliin, jossa pikselijalanjälki jo häivyttää ne. Nyt
pinnassa on iso maininki jonka päällä hieno kuvio ratsastaa, ja Snellin ikkuna
on rikkonainen aukko eikä tasainen kupu. S4 tarkistettu samalla: ruutu t = 52
on ennen ja jälkeen neljän desimaalin tarkkuudella identtinen, eli tämä ei
koske siihen.

Puhtaus tarkistettu, `npm run check` sanoo "page errors: (none)".

**Vielä avoinna samasta palautteesta:** S4:n tunneli ja S5:n metsä ovat liian
pitkiä. Ne ovat omat kierroksensa eikä niihin koskettu tässä.

### Vesiosuus, toinen kierros: kiihdytys ja liike-epäterävyys

> "Haluaisin ehkä kokeilla saisiko ennen tunnelia kiihdytettyä vauhtia veden
> alla? Ja veden partikkelit voisivat näkyä ruudulla poimuajon tyyppisenä
> efektinä — tai vaihtoehtoisesti vesimassoista tulee motion blur tyyppinen
> efekti." — "Nopeutus tulisi S3 alusta loppuun jatkuvasti kiihtyvänä."

Nuo kaksi ovat sama asia, ja jälkimmäinen on rehellinen tapa saada
ensimmäinen: **raidan pituus ON nopeus.**

#### Kiihdytys

Toinen termi, joka kytkeytyy päälle S3:n omalla iskulla ja kasvaa siitä
**kuutiona**: `s(p) = ((p−p0)/(1−p0))³`. Kuutio eikä ramppi, koska pyyntö
koskee kiihtyvyyttä eikä nopeutta — `dv/dp` kasvaa neliönä siitä kuinka
pitkällä S3:ssa ollaan, eli muutosnopeus on yhä kasvamassa läpimenon
hetkellä eikä tasaantumassa siihen. Integraali on alkeisfunktio, joten paikka
pysyy suljettuna muotona.

`p0` **luetaan aikajanalta** eikä kirjoiteta lukuna — vaihe S3:n omalla
alulla — joten jos kohtaustaulukko liikkuu, kiihdytys liikkuu sen mukana.

| p | 0.00 | 0.30 | **0.60** (S3 alkaa) | 0.75 | 0.90 | 1.00 |
|---|---|---|---|---|---|---|
| nopeus | 6.6 | 8.7 | **19.4** | 31.6 | 60.3 | **95.0** |

Loppunopeus on siis 95, ja **se luku on sopimus S4:n V0:n kanssa**: molemmat
olivat 55, molemmat ovat nyt 95. Jos nostaisi vain toista, elokuvan ainoaan
leikkaukseen joka ei saa näkyä tulisi askel. Tarkistettu numeerisesti:
`y(1) = 0.000000` ja `v(1) = 95.000`. Nousu syvenee vain 835:stä 1002:een,
koska kiihdytys on päällä vain viimeiset kaksi viidesosaa — alkua ei siis
työnnetä takaisin pimeään maksamaan lopusta.

#### Ja partikkelit ovat nyt oikeaa liike-epäterävyyttä

Hiutale on kiinni maailmassa ja **kamera liikkuu**, joten sen kuva venyy
täsmälleen kameran siirtymän verran: `view' = view + R·(v·suljinaika)`. Yksi
matriisikertolasku, ei historiaa, yhä puhdas funktio t:stä. Pyöreät pisteet
pohjalla ja pitkät raidat läpimenossa tulevat samasta kolmesta rivistä —
siksi ne eivät voi koskaan olla eri mieltä siitä miten kovaa kamera oikeasti
menee.

`gl_PointSize` ei osaa sitä (piste on neliö ruutuun nähden eikä sillä ole
suuntaa), joten kenttä on nyt **instansoituja quadeja näkymäavaruudessa** —
se sama billboard-idiomi jonka tämä projekti on joutunut opettelemaan neljästi.

Kolme asiaa piti mitata matkalla:

* **Kapseli ja quad olivat eri pituisia.** `vLong` laskettiin
  `len/(2w)`:nä vaikka `w` on jo puolileveys, joten fragmenttivaiheen piirtämä
  kapseli oli puolet siitä quadista jonka vertex rakensi — jokaisen raidan
  ulompi puolikas jäi muodon ulkopuolelle ja hylättiin, ja kenttä palautui
  näyttämään täsmälleen niiltä pyöreiltä pisteiltä jotka se korvasi, oli
  suljinaika mikä hyvänsä. Kaksi lauseketta yhdelle pituudelle, eri mieltä
  kertoimella kaksi.
* **Motit olivat liian leveitä suhteessa raitaan.** Mitattuna ensimmäinen
  versio tuli ulos kuvasuhteella 1.25 — se ei ole raita vaan mötkäle. Koko oli
  aikanaan paisutettu yksikköön ja neljäsosaan vain jotta piste ylipäätään
  rekisteröityisi; kaventaminen on vanhan kompensaation purkamista eikä uuden
  efektin lisäämistä. Alaraja on nyt **pikseleissä** ja koko ei ole.
* **Kenttä oli väärän muotoinen.** Säde 394 laittoi valtaosan moteista sen
  etäisyyden taakse jossa motti on enää motti; se linssin ohittava kuori jossa
  raita syntyy piti noin neljääkymmentä niistä. Säde puoleen, määrä 44 000.

Kaksi asiaa on tunnustettava suoraan. Raita **himmenee** pidetessään, koska
sama valo leviää useammalle pikselille — mutta laki on otettu eksponentilla
0.35 eikä täysimääräisenä, koska motin kirkkaus ei tässä varjostimessa ole
koskaan ollut mitattu suure vaan se mikä saa meriluminan lukemaan; täydellä
laki vaihtoi yhden näkymättömän kentän toiseen. Ja **suljin aukeaa
läpimenoon** samalla kuutiolla, 16 millisekunnista noin 126:een. Se on
tyylivalinta eikä fysiikkaa. Molemmat säilyttävät suunnan — pidempi on aina
himmeämpi, ja liikkumattoman kameran pitkä valotus on yhä piste — joten
efekti voi liioitella sitä miltä vauhti tuntuu mutta ei voi keksiä sitä.

Stillikuvissa raidat ovat hienovaraisia; ne on tarkoitettu liikkeeseen, jossa
kahdenkymmenen pikselin viiva kulkee kolmekymmentä pikseliä ruudussa. Sano jos
haluat ne selvästi voimakkaampina — se on kaksi lukua.

Puhtaus tarkistettu, `npm run check` läpi, ja S4:n avaus tarkistettu erikseen.

### S3 → S4: morffi, ei häivytys

> "Haluaisin että S3 ja S4-tunneli morfautuvat toisiinsa additiivisesti, ehkä
> ei pelkästään feidauksella — vaan morfautuen."

Tämä ei ole uusi idea vaan se jonka `s04-passage.js` **kirjoitti muistiin
eikä koskaan saanut**:

> *"The approach below the water belongs to S3, which SHARES THIS PATH —
> evaluate it at t < T0 and it runs backwards into the water, which is what S3
> will do."*

S3 ei tehnyt sitä. Tunneli syntyi tyhjästä leikkauksessa, ja ainoa yhteys
kohtausten välillä oli valkoinen välähdys joka peitti vaihdon.

Ristihäivytys on se mitä saa kun kaksi **eri** asiaa jakaa ruudun. Tämä on
**yksi** asia jonka kaksi kohtausta jakaa: sama rakenne (`PASSAGE_TUNNEL`),
sama rata (`passagePath`), sama väri (`PASSAGE_C0`) — kaikki kolme viety
S4:stä ulos jaettavaksi, koska kaksi tunnelia joiden on määrä olla yksi
tunneli on rakennettava yhdestä määrittelystä. Niinpä tahdilla 30 siitä ei
muutu mikään: renkaat jotka ovat jo tulossa kohti linssiä jatkavat tuloaan, ja
**leikkaus tapahtuu jatkuvan kappaleen alla eikä sille**.

Additiivisuus on se mikä tekee siitä morffin eikä liukua: tunneli piirtyy
lisäävästi lähes mustaan veteen, eikä vedestä oteta mitään pois maksuksi.
Renkaat saapuvat valona joka ilmestyy veteen — ensin **Snellin ikkunan
sisälle**, jossa kalvo on aina osannut piirtää ne (`uRings`, jota yksikään
kohtaus ei ole ennen läpimenoa koskaan kytkenyt päälle), ja sitten oikeana
geometriana pinnan takana.

Kaksi asiaa mitattiin matkalla:

* **Ramppi on kuutio eikä lineaarinen.** Lineaarinen alkaa iskulla ja lukee
  liukuna; kuutiolla tunneli on vihje ikkunan sisällä suurimman osan kahdesta
  tahdista ja muuttuu kappaleeksi vasta viimeisillä iskuilla.
* **Aksenttiväri lasketaan S4:n omalla kaavalla**, ei silmämääräisellä
  vastineella. Ensimmäisellä versiolla renkaat vaihtuivat vaaleansinisistä
  pinkiksi ja turkoosiksi tahdin 30 kohdalla — eli sävymuutos leikkauksessa,
  juuri se mitä morffi on olemassa poistamaan.

Purity tarkistettu, `npm run check` läpi.

## S4: "vesikohtauksen jälkeen tuleva tunneli on liian pitkä"

Kohtaus on 23.3 sekuntia eikä sitä voi lyhentää — musiikki päättää sen. Mitä
mitattiin, oli mikä siinä kestää.

### Kamera katsoi suoraan pyörähdyssymmetrisen tunnelin akselia pitkin

Yksi rivi: `tilt = 0.50*(1 - smoothstep)` menee **tasan nollaan** 3.4
sekunnissa läpimenon jälkeen ja jää sinne lopuiksi kahdeksikymmeneksi
sekunniksi. Kamera on akselilla `(0, y, 0)` ja katsoo akselia pitkin.

Sellainen kamera **ei voi tuottaa muuttuvaa kuvaa**: jokainen rengas on
samankeskinen ympyrä ruudun keskipisteen ympäri, ja vapaiksi jäävät vain väri
ja mittakaava. Nopeus ei näy, koska nopeus symmetria-akselia pitkin ei siirrä
mitään sivusuunnassa. Kaksi ruutua sekunnissa koko kohtauksesta: sama sommitelma
neljäkymmentäkahdeksan kertaa — kirkas pallo keskellä ja rengas ympärillä.

Mitattuna, kirkkauden painopiste ruudussa:

| | keskiarvo x / y | keskihajonta | liikelaajuus |
|---|---|---|---|
| ennen | 0.498 / 0.498 | ±0.006 / ±0.010 | 3.5 % / 4.6 % |
| jälkeen | 0.479 / 0.516 | **±0.043 / ±0.045** | **17.6 % / 18.3 %** |

Sommitelma oli naulattu keskelle **puolen prosentin tarkkuudella**; nyt se
liikkuu viisinkertaisesti ja käy lähes viidesosan ruudun leveydestä.

Korjaus ei ole kameraliike vaan se, että käytävä ei ole täysin suora eikä
lentäjä täysin keskellä: muutama aste tähtäystä pois akselilta ja muutama
yksikkö pois keskilinjalta, molemmat yhteismitattomilla taajuuksilla jotka
eivät palaa alkuun kohtauksen sisällä. Katoamispiste lähtee ruudun keskeltä ja
liikkuu, renkaat menevät epäkeskisiksi, ja linssiä lähin seinä pyyhkäisee ohi.
Molemmat on portitettu samalla rampilla jolla kallistus vaimenee, joten
läpimenon hetkellä ne ovat tasan nolla eikä S3:n liitos muutu.

### Ja kuva ei kuunnellut raitaa

Viisi koukkuvihjettä osuvat kohtiin 62.45, 64.92, 67.99, 69.10 ja 71.38 —
ja kohtaus alkaa 49.09. Eli **ensimmäiset 13.5 sekuntia 23:sta eivät sisällä
yhtään vihjettä**: yksi väri, yksi sommitelma, yksi nopeusramppi, 57 %
otoksesta. Se on se mikä on liian pitkä.

Raita ei kuitenkaan ole hiljaa siellä. **Tahdit 34 ja 35** (55.75–59.09) ovat
koko kohtauksen kovimmat: rms 0.846 ja 0.844 vasten 0.71–0.76 molemmin puolin,
kick 0.87 vasten 0.65–0.75. Kuva ohitti ainoan tapahtuman joka sillä oli.

Nyt tunnelin voimakkuus tulee raidasta — sama laite jota S9:n strobo käyttää ja
samasta kirjatusta syystä: *ajoitus on ruudukko, voimakkuus on raita.* Renkaat
myös rosoutuvat hiukan (`warp`) kun raita on kovimmillaan. Mitattuna, kirkkaan
alan osuus ruudusta kovilla tahdeilla verrattuna muihin:

| | kovat 34–35 | muut | suhde |
|---|---|---|---|
| ennen | 8.69 % | 9.04 % | **0.961** |
| jälkeen | 9.96 % | 9.04 % | **1.102** |

Ennen kuva oli kovimmilla tahdeilla vahingossa *himmeämpi* kuin muualla.

Puhtaus tarkistettu, `npm run check` läpi. **S5:n metsä on yhä avoinna.**

## S5: "metsäkohtaus on myös liian pitkä"

Kolmekymmentä sekuntia, eikä sitäkään voi lyhentää. Mitattuna, ruudun
keskihajonta kahdella ruudulla sekunnissa koko kohtauksen yli:

| | avaus (kansi) | **latvusto 84–96** | loppu |
|---|---|---|---|
| ennen | 22.4 → 18.4 | **9.3 – 10.4** | 15.8 |

Kaksitoista sekuntia — kohtauksen keskimmäinen kolmannes — puolet litteämpänä
kuin sen avaus. Kohtauksen oma kommentti kirjaa saman mittarin edelliseltä
kierrokselta: *"measured, the middle of this scene sat at a standard deviation
of 6 out of 255 where its opening is at 23"*, ja silloin nousu laskettiin
kolmestakymmenestä metristä viiteentoista. Se nosti luvun kuudesta
kymmeneen; kaksikymmentäkaksi se ei ole vieläkään.

Kaksi syytä, ja toinen on sellainen jota ei näe katsomalla yhtä ruutua.

**1. Ruutu oli peilisymmetrinen.** Viidentoista metrin korkeudesta katsottuna
kulkusilta kulki *tasan ruudun keskiviivaa pitkin*, saniaiset peilikuvina
molemmin puolin. Symmetrisessä ruudussa on puolet siitä informaatiosta miltä
siinä näyttää olevan — mikä on täsmälleen se mitä keskihajonta mittaa.

Kansiosuuksilla keskiviiva on oikein, ja kohtauksen kommentti sanoo miksi:
*"the walkway has to stay on the centre line or the leading line stops leading
anywhere."* Ylhäällä se on päinvastoin. Kamera astuu nyt sivuun keskiviivalta
sitä mukaa kun se nousee ja **pitää tähtäyksen kannessa**, joten silta kulkee
vinosti ruudun alanurkasta katoamispisteeseen sen sijaan että seisoisi
pystyssä keskellä. Sama näkymä samasta asiasta, mutta siinä on sommitelma.
Sivuttaissiirtymä heiluu hitaasti, joten diagonaalikaan ei ole kiinteä. Kaikki
on portitettu kameran korkeudella, joten kaksi kansiotosta eivät muutu.

**2. Kuva oli pakkautunut, ei vain tumma.** Ylhäällä valo tulee ylhäältä
lehtien läpi ja kaikki mitä kamera näkee on niiden varjopuoli. Nostettu
valotus ja **laskettu lift** on vastauksen halpa puoli: lift oli se joka piti
mustat irti nollasta, ja ruudussa jossa ei ole yhtään huippukohtaa nostettu
musta on koko dynamiikka.

**Mitattuna keskiosa 84–96: 9.5 → 11.7.** Ei vielä avauksen 22, mutta
kaksikymmentä prosenttia lisää dynamiikkaa ja sommitelma joka liikkuu — ja
arkilta näkee sen mitä luku ei kerro: puita tulee ruutuun, silta heilahtaa
puolelta toiselle, ja soihdut ovat eri paikoissa eri ruuduissa sen sijaan että
olisivat sama piste keskellä.

Puhtaus tarkistettu, `npm run check` läpi.

## Koko elokuva mitattuna: sommitelman pysähtyneisyys

Kun sama vika löytyi kahdesti peräkkäin — S4:n kamera symmetria-akselilla ja
S5:n kulkusilta keskiviivalla — kannatti kysyä onko sitä muualla. Koko elokuva
ajettiin uudelleen kahdella ruudulla sekunnissa ja jokaisesta kohtauksesta
laskettiin kolme lukua: ruudun oma **keskihajonta** (kuinka paljon dynamiikkaa
ruudussa on), kirkkauden **painopisteen liike** (kuinka paljon sommitelma
vaeltaa) ja peräkkäisten ruutujen **keskimääräinen ero** (kuinka paljon
ylipäätään tapahtuu).

| kohtaus | sd | painop. liike | ruutuero |
|---|---|---|---|
| S1 | 8.2 | 0.223 | **3.5** |
| S2 | 24.0 | **0.024** | 4.5 |
| S3 | 46.9 | 0.087 | 11.1 |
| S4 | 53.5 | 0.075 | 18.4 |
| S5 | 13.1 | 0.097 | 10.2 |
| S6 | 32.5 | 0.120 | 15.0 |
| S7 | 22.0 | 0.072 | 8.8 |
| S8 | 31.6 | 0.102 | 15.3 |
| **S9** | **3.1** | 0.025 | 10.4 |
| S10 | 47.7 | 0.111 | 17.2 |
| S11 | 22.0 | 0.081 | 13.2 |
| S12 | 8.5 | 0.056 | 12.0 |
| S13 | 16.4 | 0.126 | 35.1 |
| S14 | 27.0 | 0.152 | 34.8 |
| S15 | 52.1 | 0.170 | 23.4 |
| S16 | 33.3 | 0.090 | 30.1 |
| S17 | 41.0 | 0.146 | **7.7** |

**S9 on ylivoimainen ykkönen: keskihajonta 3.1**, kolmasosa seuraavaksi
litteimmästä ja alle kymmenesosa S4:stä.

### S9: silmät eivät sammu kun strobo sammuu

Tämä kohtaus ajaa valotuksen iskuruudukolta — elokuvan **yksi lisensoitu
poikkeus**, ja oikea ratkaisu, koska strobo *on* kohtaus. Mutta valotus on
globaali, joten välähdysten välissä silmiä himmennettiin täsmälleen samalla
kertoimella kuin kiveä jonka päällä ne seisovat: 0.32 vastaan 1.30 välähdyksen
aikana, eli **neljäsosaan**.

Silmäpari on **lähde**. Lähde ei himmene siitä että huonevalo sammuu.

Mitattuna, ruutu neljäsosa sekuntia iskun jälkeen: koko kuvan keskihajonta 2.5
/ 255 ja 99.9. persentiili 0.086 — eli 99,9 % ruudusta mahtuu yhdeksään
prosenttiin asteikosta, ja silmät, jotka ohjeen mukaan ovat se mistä kohtaus
kertoo (*"figures stand in the dark with red eyes"*), ovat kourallinen
pikseleitä viidenneksessä asteikkoa.

Silmille annetaan nyt takaisin se valotus jonka strobo niiltä vie, rajattuna
niin että niitä voi vain **nostaa** välähdysten välissä eikä koskaan himmentää
välähdyksen aikana. Uniformi on erillinen `uOpen`:sta, koska `uOpen` tarkoittaa
kuinka pitkälle joukko on sulkeutunut ja tämä tarkoittaa aivan muuta — ja luku
joka tarkoittaa kahta asiaa on luku joka viritetään toisen mukaan.

| ruutu | silmien huippu ennen | jälkeen | 99.9-persentiili |
|---|---|---|---|
| 133.08 | 0.286 | **0.443** | 0.086 → 0.106 |
| 136.83 | 0.282 | **0.439** | 0.086 → 0.114 |
| 141.00 | 0.306 | **0.471** | 0.090 → 0.122 |
| 143.50 | 0.337 | **0.510** | 0.098 → 0.145 |

Silmien huippu suhteessa taustaan: 4.6× → **7.1×**. Strobo, vartalot ja grade
eivät muutu; ainoa mikä muuttuu on että maailman ainoa valo lakkaa
välkkymästä huonevalon mukana. Sivutuotteena silmät saavat pienen noston myös
niillä välähdyksillä joilla kick on heikko — mikä on sama asia oikein päin:
silmien kirkkaus on vakio, huonevalo vaihtelee.

### Merkinnäksi samasta taulukosta

* **S1 ruutuero 3.5** ja **S2 painopisteen liike 0.024** — vesiosuuden se
  kohta jossa pohja on jäänyt taakse eikä kiihdytys ole vielä alkanut.
* **S17 ruutuero 7.7** kuudellakymmenellä kuudella ruudulla — elokuvan pisin
  kohtaus ja vähiten muuttuva.
* **S12 sd 8.5** — toiseksi litteintä.

Puhtaus tarkistettu, `npm run check` läpi.

## Yhdestoista kierros: yksitoista kohtaa renderistä

Koko lista kirjattuna, ja ryhmiteltynä siihen järjestykseen jossa ne tehdään.

**Morffit (kolme uutta, sama perhe kuin S3→S4):**
1. Metsän lopussa ilma alkaa säröillä ja väreillä, ja se morffautuu seuraavaan
   tunneliin.
2. Tulivuorikohtauksen lopussa tunnelin alku tulee keskelle ilmaa, josta
   morffautuu tunneliin.
3. Tunnelista saarekkeisiin: tunnelin päästä tulee blurrattuna saarekkeiden
   avaruus johon fokus tarkentuu, kamera heiluu vähän ennen kuin kohtaus alkaa.

**Flashback-rypäs (tämä kierros):**
4. Saarekkeista roikkuvat nauhat pois — eivät näytä juurilta. ✅
5. Mustat hahmot silmillä puuttuvat flashbackeistä; tasapainotus. ✅
6. Tulivuori aina samasta kuvakulmasta; eri kuvakulma joka kerta. Myös
   saarekkeista. ✅ *(ehdotettu vesiputousnousu on uusi kameraliike — ks. alla)*
7. Aavikkoa ei tarvita flashbackeissä, se on loppukohtaus. ✅

**S17 (seuraava kierros):**
8. Loppukohtaus alkaa liian aikaisin; rytmisesti noin 04:22.
9. Aavikon yli lentäminen kuin tervassa juoksemista — 2×, ehkä 2.5–3×.
10. Feikkiportaalit joutunee sijoittelemaan uudelleen nopeutuksen jälkeen.
11. Lopun fadeoutissa näkyy viimeinen feikkiportaali; pois.

### Nauhat pois

Soloitettuna kerros on täsmälleen se mitä palaute sanoo: nippuja **pitkiä,
suoria, keskenään yhdensuuntaisia kapenevia liuskoja** roikkumassa reunojen
alla. Juuri ei ole liuska. Se haarautuu, paksuuntuu haarakohdassa, mutkittelee,
eikä ole koskaan yhdensuuntainen viereisen kanssa — eikä yksikään noista ole
parametri jota olisi voinut kääntää ylös, koska primitiivi oli kapeneva quad
eikä kapenevassa quadissa ole haaroja. Poistettu.

Köynnökset jäivät: ne ovat eri populaatio ja eri lukema — lyhyitä, tiheitä,
vihreitä, reunan yli valuvia — ja palaute koskee pitkiä ruskeita.

### Joukko takaisin, aavikko pois

S12:n välähdysmaailmat olivat viidakko, tunneli, **aavikko** ja saarekkeet.
Elokuvan ainoa maailma jossa on **kasvot** puuttui siitä sarjasta joka on
matkaajan muisti; ja aavikko, joka on kuvan viimeiset kaksikymmentä sekuntia,
oli mukana. Vaihdettu keskenään. Joukko on myös parempi aave: sumu pitää
**ääriviivaa**, ja seisovien hahmojen rosoinen yläreuna on nimettävin siluetti
mikä tässä elokuvassa on — enemmän kuin dyyniviiva, joka äänettä on horisontti
siinä missä muutkin.

S14:n kastista aavikko pois samasta syystä. **S8:n viides ovi säilyttää
aavikkonsa tarkoituksella** — se on kohtauksen oma rakenne, *"four doors onto
the past and one onto something that has not happened"* — eikä se ole
flashback.

### Eri kuvakulma joka kerta

`worlds.js` antoi **yhden** hetken per maailma, ja sen kommentti perusteli sen:
sama hetki kerran valittuna tarkoittaa että leikkaus maailmaan on joka kerta
sama kuva. Se on täsmälleen oikein S8:lle, jossa viisi ovea aukeaa kerran
kukin — ja täsmälleen väärin S14:lle, jossa sama maailma tulee tusinan kertaa
kuudessatoista tahdissa. Sama kuva kaksitoista kertaa on diaesitys jossa on
kaksi diaa.

Nyt se on **lista** hetkiä, jokainen yhä kertaalleen valittu ja jokainen yhä
paikka jossa maailma näyttää itseltään — ja **otettu kohtauksen omalta
kameraradalta eikä keksitty**: tulivuoresta kaksi pistettä kiertoradalta ja
kaksi ajolta, joten kartio nähdään vastakkaisilta puolilta ja sitten alhaalta
vauhdissa; saarekkeista köli nebulaa vasten, matala ohitus ruohon yli järven
luona ja kaksi kenttänäkymää. Mitään uutta ei ole kirjoitettu — otokset olivat
jo olemassa, niitä ei vain käytetty.

Kuvakulma valitaan **kävelemällä taaksepäin** siihen leikkaukseen joka viimeksi
näytti saman maailman ja ottamalla mikä tahansa muu kuin sen käyttämä. Rajattu
kahteenkymmeneen askeleeseen, joten se on yhä puhdas funktio leikkausindeksistä
ilman tilaa ja historiaa — sama kuri jonka alla maailmanvalinta itse on, ja syy
miksi tämä kohtaus voidaan renderöidä epäjärjestyksessä kuudella prosessilla.
Pelkkä hash olisi toistanut kulman neljäsosassa tapauksista, mikä tällä
leikkausnopeudella lukee siltä että leikkaus epäonnistui.

Mustia ruutuja 0/53, puhtaus tarkistettu, `npm run check` läpi.

**Vielä pyytämättä tekemättä:** *"vesiputousta kohti niin että vesiputouksen
alta noustaan ja kiihdytetään nopeasti jokea pitkin järvelle"* on **uusi
kameraliike** eikä uusi näytepiste S11:n radalta. Se on oma kierroksensa; en
puolirakentanut sitä flashback-järjestelmän sisään.

### S17: ajoitus, nopeus ja lopun välähdys

**Ajoitus.** Mittaus vahvistaa arvion tarkasti. Tahti 157 (260.75, **4:20.75**)
on tauko: rms 0.481 vasten 0.78 molemmin puolin, kick 0.294 vasten 0.77 — ja
mid hyppää 0.898:aan. Rummut tippuvat pois yhdeksi tahdiksi ja jokin
melodinen täyttää sen. **Tahti 158 (262.42, 4:22.42) on paluu.**

Kohtaus alkoi tahdista 156, eli kaksi tahtia liian aikaisin, keskellä edellistä
fraasia — ja soitti sitten tauon läpi kuin sitä ei olisi. Nyt S16 pitää valkoisen
tauon yli ja maa saapuu iskulle jolla kick palaa. Se on myös parempi pari
sinänsä: rummut lakkaavat, kuva on tyhjä, ja molemmat alkavat uudelleen samalla
hetkellä.

**Nopeus.** *"Kuin tervassa juoksemista."* Näennäisnopeus on nopeus jaettuna
sen koolla mitä ohitetaan, ja tämä maa on valtava: `desert.js`:n pääharjanne
käy taajuudella 0.00075 eli **1333 yksikön aallonpituudella**, ja amplitudi-
kenttä joka päättää kuinka isoja dyynit ylipäätään ovat 0.00014:llä eli
**7143 yksiköllä**.

| | matka koko kohtauksessa | pääharjanteita | amplitudikenttää |
|---|---|---|---|
| V = 70 | 2333 yks | **1.75** | 0.33 |
| V = 190 | 5700 yks | **4.28** | 0.80 |

Vanhalla nopeudella pääharjanne ohitti **alle kaksi kertaa koko kohtauksessa**
ja dyynien koko ei muuttunut kertaakaan: yksi laikku yhden kokoisia dyynejä,
puolen minuutin ajan, kameran alla joka nimellisesti lensi. Se on se terva.
190:llä harjanne ohittaa seitsemän sekunnin välein, toissijainen puolentoista
sekunnin välein, ja dyynien koko ehtii näkyvästi muuttua kertaalleen.

**Feikkiportaaleja ei tarvinnut siirtää**, ja se kannattaa sanoa koska se oli
ilmeinen huoli: jokainen niistä on sijoitettu **kiinteään pisteeseen
maailmassa**, laskettuna siitä missä kamera on *sen oman hetken* kohdalla — eli
etäisyys niihin ei muutu. Ainoa mikä kasvaa on kuinka paljon kamera lähestyy
niitä niiden elinaikana: 133 yksiköstä 361:een, 2900 yksikön etäisyyttä vasten
eli viidestä prosentista kahteentoista.

**Viimeinen välähdys pois.** Se oli elokuvan ainoa tapahtuma joka oli ajastettu
tiettyyn ääneen — viimeinen isku tahdilla 174.1 — ja tarkoituksella ammuttu
**häivytyksen sisään** niin että musta ottaa sen kesken leimahduksen. Perustelu
oli että elokuvan viimeinen kuva on portti joka ei vieläkään ole portti.

Palaute on sama tosiasia toisin päin, ja se lukema voittaa koska se on
katsomisesta: **häivytys on väite siitä että kuva loppuu**, ja jokin kirkas joka
saapuu sen sisään ei lue välimerkkinä vaan siltä että häivytys ei peitä jotain.
Idea vaati että leimahdus on luettava ja häivytys on rehellinen yhtä aikaa,
eivätkä ne molemmat voi olla totta samasta sekunnista. Poistettu — kommenttina
eikä pois kytkettynä rivinä, koska sammutettu tapahtuma aikataulussa on asia
jonka joku kytkee takaisin lukematta miksi se oli pois.

Loppu on nyt mustaa kohdasta 290.0 raidan loppuun asti, joka ruudulla maksimi
0. Puhtaus tarkistettu, `npm run check` läpi.

**Katsottavaa renderissä:** S16 pitenee kahdella tahdilla, eli valkoista on nyt
noin seitsemän sekuntia ennen aavikkoa. Se on tarkoituksellinen pari tauon
kanssa, mutta se on pisin yhtenäinen valkoinen elokuvassa.

### Morffi 1/3: metsä → tunneli

> "Metsän lopussa ilma alkaa säröilemään ja väreilemään ja vääristymään, joka
> morfautuu seuraavaan tunneliin."

S6:n oma otsikko sanoo tämän jo, eikä sitä ollut koskaan tehty:

> *"The first gateway had a threshold: a surface to break, a membrane that let
> light through before it let us through. This one does not. There is no water
> here — **the jungle simply stops holding together and the tunnel is what is
> left.**"*

Ja sitten elokuva vain leikkasi, eikä mikään lakannut pysymästä kasassa.

Sama resepti kuin S3→S4:ssä ja samasta syystä: **S5 piirtää S6:n OMAN
tunnelin** — sama rakenne (`SECOND_TUNNEL`), sama rata (`secondPath`, jota
evaluoidaan sen oman T0:n alapuolella missä se juoksee taaksepäin ulos
kohtauksesta), sama väri (`SECOND_C0`) — kaksi tahtia etuajassa ja
**lisäävästi** viidakkoon joka on jo valumassa lähes mustaksi. Mitään metsästä
ei oteta pois maksuksi; renkaat saapuvat valona joka ilmestyy runkojen väliin.
Tahdilla 62 objektista ei muutu mikään.

Kolme muuta asiaa kantaa "säröilyn":

* **`warp`** tunnelissa — se sama parametri jolla S15:n käytävä hajoaa,
  käytettynä tässä sellaiseen joka ei ole vielä valmiiksi saapunut. Kaaret
  tulevat rosoisina.
* **`uFish`**, elokuvan oma kynnyslinssi: S13:n räpsähdys on rakennettu sille,
  joten sen käyttäminen tässä sitoo kaksi siirtymää yhteen ideaan sen sijaan
  että keksisi toisen. Kolmasosa siitä mihin S13 aukeaa.
* **`uSplit`** nousee mukana — kompositin oma tapa sanoa että *kuva* ei
  rekisteröidy, ei että edessä on lasia.

#### Ja yksi oikea vika matkalla: tunneli oli pystyssä maan alla

`Tunnel` rakentaa renkaansa **maailman Y-akselin ympärille** ja saa kameran
paikan sitä pitkin `travel(t)`:nä — pystykuilu, koska jokainen sitä käyttänyt
kohtaus lentää suoraan ylös. Ensimmäisen läpimenon morffi sai sen ilmaiseksi:
vesikamera katsoo ylös, joten kuilu oli valmiiksi sen edessä. Tämä ei katso.
Viidakkokamera istuu pään korkeudella ja katsoo vaakasuoraan pitkin
kulkusiltaa, joten ensimmäinen yritys piirsi täysin kelvollisen tunnelin
**seisomaan maahan saniaisten alle, ruudun ulkopuolelle** — ja kuva palasi
kalansilmämutkalla eikä missään muulla.

Neljänneskierros X:n ympäri kuvaa tunnelin +Y:n maailman −Z:lle, jonne tämä
kamera katsoo, ja ryhmä siirretään niin että kamera istuu tasan akselilla omalla
`travel`-koordinaatillaan: piste tunnelin korkeudella h päätyy kohtaan
`z = camZ + T − h`, joten `h > T` on edessä. **Mikään `Tunnel`:in sisällä ei
muutu** — se luulee yhä olevansa pystyssä, ja se on koko syy tehdä tämä
muunnoksella eikä toisella koodipolulla.

Tarkistettu: S5 kohdassa t = 90 on ennen ja jälkeen **tavulleen sama** (ero
0.0), eli morffi ei kosketa mihinkään muuhun kuin kahteen viimeiseen tahtiin.
Puhtaus tarkistettu, `npm run check` läpi.

**Jäljellä: morffi 2/3 (tulivuori → tunneli) ja 3/3 (tunneli → saarekkeet).**

---

## Kierros: morffi 2/3 (tulivuori → tunneli) ja 3/3 (tunneli → saarekkeet)

Sama resepti kuin metsässä, kahdesti — ja jälkimmäinen ensimmäistä kertaa
**takaperin**.

### 2/3, S7 → S8

Tulivuorikohtaus piirtää kaksi viimeistä tahtia S8:n **omaa** tunnelia: sama
`GATEWAY_TUNNEL`-määrittely, sama `gatewayPath` omalta jaksoltaan ulkopuolelta
laskettuna, sama korostusväri S8:n omalla HSL-kaavalla. `layTunnelAlong()`
kääntää ryhmän kameran katsesuuntaan, joten suu aukeaa **keskelle ilmaa** tasangon
yllä, sankaritulivuoren kohdalle. Ramppi kuutiona, additiivisesti pimenevään
maailmaan: mitään ei oteta pois maksuksi, ja juuri se tekee siitä morffin eikä
ristikuvan.

Renderöity 4 fps välillä 124–129 s. Leikkaus 127.42 osuu esineen sisään, joka oli
jo kuvassa.

### 3/3, S10 → S11

Tämä menee toiseen suuntaan. Lähtevä kohtaus ei piirrä saapuvaa; **saapuva
kohtaus jatkaa lähtevän piirtämistä.** Saarekekohtaus piirtää tahdin verran
leikkauksen jälkeen S10:n omaa käytävää, ja sen takaa saarekkeiden avaruus
tarkentuu kahden tahdin aikana.

Kolme asiaa jouduttiin mittaamaan erikseen:

**1. Nimi `this.path` oli jo varattu.** `IslandsScene`:llä on oma
`path(t, out)`-metodi, joka kertoo missä kamera on. Kun tunnelin polku
sijoitettiin samaan nimeen, se peitti metodin ja koko kohtaus kaatui
`this.path is not a function`. `npm run check` **löysi tämän**, toisin kuin
kahdesti aiemmin — koska vika ei ollut morffi-ikkunan sisällä vaan joka
ruudussa. Nimeksi `this.tpath`.

**2. Fokusveto ei näkynyt, vaikka se oli päällä.** Syy oli defocus-passin
ensimmäisellä rivillä: **taivaskupu on vapautettu epäterävyydestä**, jotta
tähdet ja kuu pysyvät pisteinä. Tässä kohtauksessa tausta *on* sumu ja
useampi tuhat tähteä — kaikki kuvun päällä. Silmä lukee kuvan tarkaksi sillä
hetkellä kun **yksikin** reuna siinä on tarkka, joten terävä tähtitaivas teki
vedosta pehmeän etualan eikä tarkentumatonta kuvaa. Lisätty `uSkyDefocus`
(oletus 0 = vanha käytös kaikkialla, `Post.reset()` palauttaa sen): kun se on
yli nollan, kupu käsitellään rampin takana olevana ja sen säde skaalataan
uniformilla, joten vapautus voidaan sulkea jatkuvasti eikä kytkimellä. Säde
7.5 px oli utua; 26 px (1080-riviä vasten) on veto.

**3. Fokusveto söi tunnelin.** Lähikuvataso oli 2 yksikköä, eli kaikki kahta
yksikköä kauempi pehmeni — myös renkaat, jotka olivat vielä kameran ympärillä.
Veto joka liuottaa sen esineen, josta ollaan tarkentamassa **pois**, on
ristikuva. Lähitaso pidetään 60 yksikössä (käytävän säde) kunnes veto on ohi.

**4. Rengas ilmestyi takaisin.** Käytävä oli sidottu vedon kahden tahdin
ikkunaan, mutta renkaat saapuvat jaksollisesti: hidas häntä ei häivytä käytävää,
se häivyttää yhden renkaan sillä aikaa kun seuraava piirtyy. Kolme neljäsosaa
vedosta myöhemmin ilmestyvä rengas lukee virheenä. Oma ikkuna, yksi tahti,
kuutiona — viimeinen rengas on kameran takana ennen kuin seuraava piirrettäisiin.

Kamera on epävakaa saman ikkunan ajan, ja **tähtäyspisteeseen** eikä paikkaan
sovellettuna, kahdella yhteismitattomalla taajuudella: käsi joka ei ole
asettunut kääntyy, se ei liu'u.

Puhtaus tarkistettu (S11 t = 156.40 tavulleen sama kahdessa eri selainistunnossa),
`npm run check` läpi, sivuvirheitä ei ole.

**Listan kohta 3 on nyt tehty. Koko yhdentoista kohdan lista on käyty läpi**
paitsi vesiputouskamera-ajo, joka on oma kierroksensa.

---

## Kierros: vesiputousajo

Listan viimeinen kohta: *"Voisi esim. olla vesiputousta kohti niin että
vesiputouksen alta noustaan ja kiihdytetään nopeasti jokea pitkin järvelle."*

### Miksi tämä ei ollut näytepiste vaan uusi ajo

Kaikki muut `worlds.js`:n kuvakulmat ovat **hetkiä**: kohtaus tekee jo sen
kamera-ajon, ja taulukko valitsee siitä ajanhetken. Tätä ajoa ei ole
kohtauksessa — kuvakäsikirjoitus ei vie kameraa kertaakaan putouksen alle eikä
joelle. Siksi se on kirjoitettu `IslandsScene`:een käyränä, ja `worlds.js`
osoittaa siihen samalla tavalla kuin hetkiin (`moves` `ats`:n rinnalla).

### Ankkurointi

Käyrä on rakennettu **veden omista luvuista** eikä luvuista jotka muistuttavat
niitä. `env/islands.js` päättää kerran missä järvi on (`lc`, `level`), mistä
puro lähtee tasanteelta (`lip`, `lipY`, `lipT`), mihin suuntaan uoma menee ja
miten se mutkittelee (`dir`, `bend` — sama suljettu muoto jonka sekä kaiverrus
että nauha lukevat), ja kuinka kaukana putoava vesi roikkuu kalliosta (`outR`).
Toinen mittaus samasta käyrästä olisi ollut eri mittaus — tämän tiedoston
jokaisen bugin toistuva muoto.

Viisi ankkuria: putouksen alla ja ulkopuolella → noustu harjanteen ohi, yhä
kalliosta erossa → huulen yli → uomaa alas puron yllä → järven suulle. A1→A2
ylittää reunan **huulen korkeuden yläpuolella** tarkoituksella, koska kallio on
leveimmillään juuri sen alla.

### Kolme asiaa mitattiin ja korjattiin

**1. Kaksi kuutta koeruudusta oli tyhjää taivasta.** Tähtäys oli "piste vähän
edempänä omalla polulla". Nousu on lähes pystysuora, joten piste edempänä on
piste **suoraan yläpuolella** — ja ylöspäin osoittava kamera kuvaa sumua sillä
aikaa kun vesiputous, jota sen piti seurata, valuu ruudun alalaidasta pois.
Nyt tähtäys on **harjanne** niin kauan kuin kiivetään ja vasta sitten piste
edempänä, ja vaihto tehdään ikkunassa 0.40–0.56 kaaresta: alle 0.40 johtopiste
on yhä nousulla, yli 0.6 harjanne on siellä missä objektiivi on.

**2. 72 % ajosta oli nousua.** Kiihtyvyys tarkoittaa hitautta alussa, ja nousu
on alussa, joten se söi ajon. Nousu lyhennettiin tilassa (0.62 putouskorkeutta
harjanteen alapuolelta, ei 0.95) ja nopeuskäyrä loivennettiin muotoon
`0.16u + 0.84u²`. Hetkellinen nopeus on silti kymmenkertainen järvellä
putoukseen nähden — se on se mikä luetaan kiihdytyksenä.

**3. Loppu oli ruoho­kuva.** Järven keskellä, kahdeksasosaradan verran pinnan
yläpuolella, vaakasuora katse jättää veden 15–27 astetta akselin alapuolelle
eli 58 asteen ruudun alareunan ulkopuolelle. Ajo päättyy nyt **suulle**, ja
tähtäys asettuu järven **vastarannalle** — paikkaan eikä suuntaan.

### Sivulöydös: yksi S14:n leikkaus oli valkoinen kortti

Kun ajo oli paikallaan, S14 mitattiin kokonaan (54 ruutua, 2 fps). Tunnelin
neljäs kuvakulma oli tahti 43, ja tahti 43 **plus tämän maailman 1.4 sekunnin
ikkuna** osuu S4:n saapumiseen: käytävä puhkeaa valkoiseksi metsään viimeisen
sekuntinsa aikana, ja mitattuna ruutu oli tasainen 0.84 harmaa, sd 15.

Kuvakulma ei ole täällä hetki vaan **hetki ja ikkuna**, ja sen pitää olla
luettava koko ikkunan ajan — sama vika kuin mustan maailman `dur`:issa
aiemmin. Kuvakulmat ovat nyt 34, 37, 40, 42 ja jättävät käytävän kaksi
viimeistä tahtia rauhaan. Uusi mittaus: mitään yli 0.30 keskiarvon ilman
rakennetta, mitään alle 0.03. Mediaani 0.19, vaihteluväli 0.10–0.30.

### Havainto, ei korjattu

Tämä ajo on ensimmäinen kuva filmissä joka menee järvelle asti, ja se paljastaa
että **järven pinta istuu maan päällä kiekkona** eikä altaassa: `C.level`
nostetaan korkeimman pohjahuipun yläpuolelle, jotta pinta ei leikkaantuisi
rikki, ja lähikuvassa se näkyy reunuksena. Ei koskettu tällä kierroksella —
kerro jos haluat sen omaksi kierroksekseen.

**Yhdentoista kohdan lista on nyt kokonaan käyty läpi.**

---

## Korjauslista seuraavaksi (katselu 2026-09-01)

Kolme kohtaa, kirjattu tässä muodossa jotta seuraava kierros voi alkaa suoraan
niistä. Ei vielä koskettu koodiin.

### 1. Siirtymä loppuaavikkoon töksähtää — morffi myös siihen

*"Siirtymä lopun aavikkokohtaukseen töksähti, eli siihen voisi tehdä kans
blurrauksen/morfauksen."*

S16 → S17, tahti 158. Tämä on ainoa filmin isoista siirtymistä johon ei ole
tehty mitään, ja se on nyt korostunut kahdesta syystä: neljä muuta on morfattu,
ja loppukohtauksen ajoitus siirtyi tahtiin 158, eli leikkaus osuu eri kohtaan
musiikkia kuin ennen.

Huomioitavaa etukäteen: kolme ensimmäistä morffia ovat "lähtevä kohtaus piirtää
saapuvan tunnelin", ja neljäs on sama takaperin. Aavikolla **ei ole tunnelia**
kummallakaan puolella, joten reseptiä ei voi kopioida sellaisenaan — tähän
tarvitaan joko oma yhteinen esine tai se blurraus jota palautteessa
ehdotetaan. S10→S11:n fokusveto (`uSkyDefocus`, lähitason pito) on todennäköisin
lähtökohta, koska se on jo olemassa ja se toimii ilman yhteistä geometriaa.

### 2. Silmähahmot ovat väläyksissä liian valaistuja — strobo niihin

*"Pimeässä hohtavilla silmillä olevat henkilöt näkyivät väläyksissä liian
suuressa valaistuksessa. Haluaisin pitää että henkilöt ovat hämärässä ja voisi
lisätä väläyksissä strobovaloa niihin."*

Koskee `dark`-maailmaa flashbackeissä (S12:n kolmas välähdysmaailma ja S14:n
leikkaukset). Nyt hahmot näkyvät kokonaan.

Huomioitavaa: tämän maailman `dur` on **0.026 s** — se on tahallaan tasan yhden
strobovälähdyksen mittainen, koska aiemmin 1.2 s käveli vaiheen strobon pimeän
osan yli ja joka kuudes leikkaus oli musta. Eli maailma on jo *sisällä*
välähdyksessä, ja siksi se näyttää täydeltä valaistukselta. Se mitä pyydetään on
päinvastainen: hahmot hämärään ja **strobo päälle leikkauksen sisällä**. Tämä
tarkoittaa että `dur` on avattava takaisin ja S9:n oman strobon annettava käydä
leikkauksen aikana — eli sama luku joka korjattiin viime kerralla, korjataan nyt
toiseen suuntaan eri syystä. Se on tehtävä silmät auki: mustan ruudun riski
palaa, ellei perustaso ole nollaa suurempi. Käytännössä: nosta hahmojen
pohjavalaistus hämäräksi (ei nollaksi), laske välähdyksen huippu, ja päästä
`dur` monen välähdyksen mittaiseksi.

### 3. Loppukohtauksen alkuun kaarto puolelta toiselle

*"Loppukohtauksessa myös voitaisiin alussa vähän kaarrella puolelta toiselle,
vähän kuin lennettäisiin tasaisesti ensin kääntyen vasempaan ja sitten
oikeaan."*

S17. Kamera lentää nyt suoraan, ja `CAM_V` nostettiin 190:een viime
kierroksella, joten suoruus näkyy enemmän kuin ennen. Pyydetään loivaa
kaartoa — vasen, sitten oikea — kohtauksen alkuun.

Huomioitavaa: kaarto on kallistus **ja** kurssinmuutos, ei pelkkä `camera.up`:n
kierto. Jos vain kallistetaan, se lukee horisontin kiertona eikä lentona. Ja
feikkiportaalit on mitattu nykyistä suoraa kurssia vasten — kurssin muuttaminen
voi tuoda ne eri etäisyyksille, mikä oli jo kerran listalla (kohta 10) ja
todettiin silloin tarpeettomaksi. Se mittaus on tehtävä uudelleen kaarron
jälkeen.

**Jatketaan huomenna.**

---

## Kierros: aavikon alku — ja kahden tahdin virhe joka oli ollut koko ajan

*"Aavikkokohtaus alkaa hetken liian aikaisin... ajoitetaan biittien mukaan
tahdin ekalle biitille aavikon alku (noin 04:22, olisikohan tarkka bar 158.1)."*

### Ensin: minä olin väärässä, ja se piti mitata näkyviin

Loppukohtauksen ajoitus siirrettiin tahtiin 158 kaksi kierrosta sitten, ja
merkitsin sen tehdyksi. Se ei ollut tehty. `scenes.json` sanoi 158 —
`data/timeline.json` sanoi yhä 156, koska `tools/build-timeline.mjs` jäi
ajamatta. **Ja timeline.json on se jonka jokainen kohtaus lukee.**
Suunnitteludokumentti ja filmi olivat eri mieltä kahden tahdin verran, ja
jokainen renderöinti sen jälkeen kantoi vanhaa lukua.

Mitattu: aavikko ilmestyi 259.08 (tahti 156), ei 262.42 (tahti 158). Ero 3.33 s
— tasan se "hetki liian aikaisin".

Tämä on tämän projektin toistuva vikamuoto uudessa muodossa: **kaksi lauseketta
samasta luvusta, jotka ovat eri mieltä.** Aiemmin se oli kaksi kaavaa samassa
tiedostossa; nyt se oli dokumentti ja ajonaikainen taulu. Työkalu itse oli
oikeassa — `build-timeline.mjs` kieltäytyi kirjoittamasta ennen kuin kuvan
`Somewhere` (tahdit 156–162) korjattiin S17:n uusiin rajoihin. Se väite pelasti
tämän toisen kerran menemästä läpi hiljaa.

**Muistisääntö jatkoon: `scenes.json`:in tahtinumeron muuttaminen ei tee
mitään ennen kuin `npm run timeline` ja kopio `public/data/`:iin on ajettu.**

### Valkoinen

Korjauksen jälkeen valkoinen pitää 258.03:sta (lyriikkavihje "Into the light")
tahtiin 158 asti, eli 4.4 s. Mitattuna keskiarvo 0.844, sd 0.041,
ruutujenvälinen ero 0.007 — se on kortti, ja sen kuuluu olla. Siinä on se
toinen, kaikuva "into the light" jonka kohdalle pyysit sen.

### Siirtymä

Neljän muun morffin resepti — kaksi kohtausta jakavat **esineen**, joka
piirretään additiivisesti — ei toimi tässä: kummallakaan puolella ei ole
tunnelia ja toisella puolella ei ole geometriaa lainkaan. Jaettava asia on
**valkoinen itse**.

Tahdin 158 ykkösellä S17 alkaa S16:n omasta arvosta ja kortti nousee pois:
`uFlash` 0.355 (mitattu, ei valittu — antaa 0.860 vasten S16:n 0.844) laskee
yhden tahdin aikana, ja sen alla tarkennus vetää sisään kahden tahdin aikana:
lähitaso objektiiviin, leveä säde, ja **`uSkyDefocus` päällä**, koska aavikko on
kaksi kolmasosaa taivasta ja terävä taivas olisi jättänyt kuvan luettavaksi koko
vedon ajan — sama löydös kuin S11:n saapumisessa.

Ruutujenvälinen ero liitoksessa: **75.5 → 15.2**, ja siitä jäljellä oleva on
aavikko joka alkaa näkyä. Se on se mitä tahdin ykkösen kuuluu tehdä.

Tämä on filmin ainoa paikka jossa `uFlash` on oikea työkalu eikä bugi. Muualla
se oli väärä koska se levittää tasaisen kortin kuvan päälle; tässä leikkausta
edeltävä ruutu **on** tasainen kortti, ja sen jatkaminen on täsmälleen se mitä
match cut tarkoittaa.

### Havainto, ei korjattu

S16:n valokiekko on ruudun keskellä (se on tunnelin akselilla, määritelmän
mukaan), ja aavikon aurinko on oikeassa ylälaidassa. Ne eivät osu yhteen. En
siirtänyt kumpaakaan: S16:n kiekon siirtäminen tarkoittaisi kameran viemistä
pois akselilta, mikä on vastoin koko kohtauksen ideaa, ja auringon siirtäminen
olisi valheellista. Vedon aikana valkoinen peittää asian, mutta jos se häiritsee
katsottuna, sano.

---

## Kierros: aavikon sisääntulo sirpaloituu

*"Saisitko vielä autiomaan sisäänmorfautumisen samalla tavalla 'sirpaloidusti'
kuin feikkiportaalit?"*

Feikkiportaalit ovat `env/desert.js`:ssä F1/F2-soluruutua (Voronoi): **Voronoi-solu
ON tasapintainen sirpale**, ja juuri siksi siihen tartuttiin sinne alunperin.
Sama kuvio nyt koko ruudun kokoisena.

`uFlash` on skalaari — se ei voi vaihdella paikan mukana — joten kompositoriin
tuli oma termi (`shardCell()` + `uShardAmt/T/Cells/Seed`, oletus 0, `reset()`
nollaa). Jokainen solu kantaa **oman lähtökynnyksensä** solun id:stä, joten ne
lähtevät hajautetusti eivätkä yhtenä rintamana, ja jokainen leimahtaa omista
reunoistaan lähtiessään — lasi ottaa valon lähtiessään.

Kaksi asiaa piti kirjoittaa tarkasti:

**1. Molemmat päät eksakteiksi.** `T = 1` → jokaisen solun `k` on tasan 1, eli
tasainen kortti eikä mitään muuta; `T = 0` → jokaisen solun `k` on tasan 0, eli
ei korttia lainkaan. Kynnysmalli joka vain lähestyy nollaa jättäisi pysyvän
utupeitteen sille kuvalle jonka se juuri paljasti. Kaava
`k = smoothstep(own*(1-w), own*(1-w)+w, T)`, `own` = solun id ∈ [0,1].

**2. Reunaleimahdus `k²(1-k)` eikä `k(1-k)`.** Jälkimmäinen oli itsestään
selvä muoto ja se jätti viimeiset solut **onttoina ääriviivoina** jo
tarkentuneen aavikon päälle: arvolla k = 0.06 se palauttaa yhä 0.22 huipusta,
mikä on piirretty viiva. Uusi muoto palauttaa 0.02.

Solukoko: yhdeksän solua ruudun leveydeltä. Kaksikymmentä luki konfettina eikä
lasina; harvempi tekisi yhdestä lähtevästä solusta pyyhkäisyn.

Mitattu liitoksessa: **215.4 → 219.4, ruutujenvälinen ero 15.3** — sama kuin
pehmeällä versiolla (15.2), eli sirpalointi ei maksa mitään liitoksessa. Murron
aikana ero on 8–13 kolmen neljäsosan sekunnin ajan, kun pehmeässä versiossa se
oli 5–7. Se on oikein päin: murtuminen on tapahtuma eikä ristikuva.

Tarkistettu: S14 tahdilla 230.75 on **tavulleen sama** kuin ennen `post.js`:n
muutosta, eli uusi termi ei vuoda mihinkään. Puhtaus tarkistettu, `npm run
check` läpi.

---

## Kierros: silmähahmojen strobo ja loppukohtauksen kaarto

Listan kaksi viimeistä kohtaa.

### Strobo — sama luku korjattuna toiseen suuntaan

*"Pimeässä hohtavilla silmillä olevat henkilöt näkyivät väläyksissä liian
suuressa valaistuksessa. Haluaisin pitää että henkilöt ovat hämärässä ja voisi
lisätä väläyksissä strobovaloa niihin."*

Syy oli tarkalleen se korjaus jonka tein pari kierrosta sitten. S9:n oma strobo
palaa **kaksi ruutua joka iskulla**, eli kahdeksan prosenttia ajasta. Se on
oikein kun kohtausta katsotaan kahdeksan tahtia; se on väärin kun välähdys
näyttää maailmaa viidesosasekunnin, koska se mihin välähdys osuu **on** koko
leikkaus. Siksi `worlds.js` otti näytteen **välähdyksen sisältä** ja antoi
ikkunaksi yhden välähdyksen mitan (0.026 s) — mikä on täsmälleen se, mikä saa
joukon näyttämään täysin valaistulta. Edellinen korjaus tuotti tämän valituksen.

Nyt takaumalla on **oma valonsa**, ja se on päinvastaisen muotoinen: **hämärä
pohja joka on aina päällä**, ja sen päällä nopea pulssi. Kaksi seurausta, ja
molemmat ovat pointti — hahmot ovat puolipimeässä, ja ikkuna voidaan avata
kyllin leveäksi että pulssi ehtii käydä leikkauksen sisällä, koska pimeää osaa
johon osua ei enää ole. `dur` 0.026 → 0.55.

Kaksi asiaa piti tehdä oikein:

**1. Sinimuotoinen eikä kanttiaalto.** Kanttistrobo tällä taajuudella on
yhden–kahden ruudun levyinen eli alinäytteistetty — sama vika jonka takia
`FLASH_S` aikanaan kirjoitettiin — ja pahempi tässä, koska takaumat voidaan
renderöidä millä ruutunopeudella tahansa. Kosini näytteistyy oikein millä
tahansa nopeudella; potenssikäyrä antaa sille takaisin lyhyen huipun ja pitkän
pimeän, mikä tekee siitä strobon eikä sykkeen.

**2. Kutsujan kello, ei maailman.** Leikkauksen vaihe etenee 0.55 leikkauksen
yli, joten 0.55 sekunnin ikkuna kulkee tahdin mittaisen leikkauksen sisällä
viidesosanopeudella ja kahdeksasosaleikkauksen sisällä puolitoistakertaisella —
**kahdeksankertainen vaihteluväli**. Ensimmäinen versio ajoi strobon maailman
omalla kellolla, ja mitattuna 11 Hz tuli ulos 2 hertsinä. `drawWorld` välittää
nyt kutsujan `t`:n.

Mitattu: keskiarvo heiluu 16.3 ↔ 25.0, sd 3.2 ↔ 12.4, huippuvalotus 0.93 vasten
kohtauksen omaa 1.30. Silmät säilyttävät kompensaationsa, joten ne ovat ruudun
kirkkain asia ja pulssi näyttää vartalot. Koko S14 mitattu uudelleen (54 ruutua):
ei yhtään mustaa eikä pesuun mennyttä ruutua, mediaani 0.19.

### Kaarto

*"Loppukohtauksessa voitaisiin alussa vähän kaarrella puolelta toiselle, vähän
kuin lennettäisiin tasaisesti ensin kääntyen vasempaan ja sitten oikeaan."*

Tämä **kumoaa osittain aiemman ohjeen**, ja se on syytä sanoa eikä kirjoittaa
hiljaa yli: ensimmäinen versio pyyhkäisi kameraa leveässä hakukaaressa, ja sen
poistanut ohje oli yksiselitteinen — *"kamera liikkuu sulavasti eteenpäin... ei
käännytä sivulle"*. Tämä ei ole se kaari takaisin. Viisi tahtia kohtauksen
alussa ja sitten suoraan eteenpäin loput kolmetoista, ja ero on koko juju:
kamera joka kääntyy koko ajan etsii, kamera joka asettuu on saapunut.

Kaarto on **suunnanmuutos JA kallistus**, ei kallistus. Pelkkä kallistus lukee
dutch-kulmana; pelkkä suunnanmuutos lukee jalustapanorointina. Kaikki kolme
tulevat yhdestä funktiosta yhdestä muuttujasta:

```
f(s) = sin(2πs)·sin²(πs)      yksi lohko vasemmalle, sitten yksi oikealle
yaw  = -A·f                    minne kamera katsoo ja lentää
roll ∝ df/ds                   kallistus kääntymisnopeuden mukaan
lat  ∝ -∫f                     minne se sen vie
```

Kolme erillistä käyrää olisi ennen pitkää eri mieltä — tämän projektin
toistuva vika. `f` on valittu niin että **se, sen derivaatta ja sen integraali
ovat kaikki tasan nollia molemmissa päissä**: kohtaus alkaa ja päättyy
vaakatasossa, suunnassa, keskiviivalla. Integraali on suljetussa muodossa,
koska `desert.js` sijoittaa jokaisen feikkiportaalin kiinteään maailmapisteeseen
joka lasketaan siitä missä kamera on **sen tapahtuman omalla hetkellä** — eli
kameran paikan on oltava vastattavissa millä t:llä tahansa.

**Kaksi omaa virhettäni, molemmat mittaus löysi:**

`df/ds`:n maksimi on haarassa `sin(a) = 0` eikä siinä ilmeisemmässä
`cos(a) = 0.25`:ssä. Otin vain jälkimmäisen, ja kallistus oli **1.78-kertainen**
siihen mitä oli kirjoitettu: 6.6 astetta kirjoitettuna, 11.3 astetta mitattuna
horisontista.

Ja etumerkki oli väärin — kamera kallistui **oikealle vasemmalle kääntyessään**,
mikä lukee dutch-kulmana eikä lentämisenä. Korjattu ja tarkistettu mittaamalla
horisontin kaltevuus kymmeneltä hetkeltä: seuraa kirjoitettua kallistusta,
maksimi 5.7° mitattuna vs 6.6° kirjoitettuna (ero on dyyniharjanteet joita
horisontti-ilmaisin käyttää), ja kaarron jälkeen 0.1° eli vaakatasossa.

**Korjauslista on nyt tyhjä.**

---

## Kierros: tulivuoren värinä ja aavikon keinunta koko matkalle

### 1. Värinä — neljä vikaa, ja rehellinen loppupäätelmä

*"Tulivuorikohtauksessa näkyi tulivuorien pinnalla ja vieressä värinää."*

**Mittausväline piti ensin rakentaa.** Ruutujenvälinen ero ei kelpaa tähän: se
ei erota **liikkunutta** kuvaa **välkkyvästä**. Kolme ensimmäistä diagnoosia
menivät hukkaan juuri siksi — kuutiollinen trendinpoisto viidentoista ruudun yli
antoi jäännöksen joka on *kuva verkosta*, ja luulin sitä löydöksi, vaikka se oli
vain "reunat pyyhkäisevät pikselien yli". Vasta **lohkosovitettu
liikekompensoitu jäännös** (16×16 lohkot, ±10 px haku, sitten jäännös) kertoo
mikä muuttuu ilman että liike selittää sen.

Neljä vikaa löytyi, ja kaikki ovat oikeita:

**(1) Kamera oli korkeuskentän sisällä.** `lavaFront` levensi laavalohkon
rintamaa *etäisyydellä kamerasta*, ja `surfH()` lukee sen — eli jokaisen
verteksin korkeus oli funktio siitä missä kamera on. Hilaan lukitseminen, jonka
koko tarkoitus on pitää maasto paikallaan, piti **näytepisteet** paikallaan
sillä aikaa kun **kenttä** liikkui niiden alla. Ja pahempaa: takaumissa
tulivuorimaailma valokuvataan neljästä eri kuvakulmasta, eli sillä oli neljä eri
muotoa. Perustelu levennykselle oli väärin päin: verkon näytetiheys **ei** laske
etäisyyden mukana — se on 19.35 yksikköä karkealla tasolla ja 6.8 lähipaikalla,
tasaisesti. Ruututiheys laskee, ja se on laskostumisongelma eikä geometrinen.

**(2) Kaksi verkkoa menivät päällekkäin eivätkä laatoittaneet.** Vanha
kommentti väitti kaistan olevan "sata yksikköä kahta verkkoa jotka laskevat
saman lausekkeen — ainoa saumatyyppi joka ei voi näkyä". Molemmat puoliskot
olivat väärin: **paikka on neliö ja reikä on ympyrä**, joten kaista on 100
yksikköä akseleilla ja 871 kulmissa. Ja yksi lauseke laskettuna 19-yksikön
hilalla ja 6.8-yksikön hilalla **ei ole yksi pinta** — juuri se ero on koko syy
lähipaikan olemassaoloon. Missä ne ovat lähellä toisiaan ne z-tappelevat, ja
kumpikin on lukittu **omaan** hilaansa, joten tappelun kuvio arvotaan uudelleen
aina kun jompikumpi askeltaa. Nyt ne laatoittavat, ja jäljelle jäävän 40
yksikön kaistan lähipaikka voittaa syvyyssiirtymällä.

**(3) Normaalit olivat etudifferenssejä.** Jokainen verteksi sai *viereisen*
solun normaalin, ei oman pisteensä, joten interpoloitu varjostus vaihtoi
kulmakerrointa joka solurajalla. Keskeisdifferenssit.

**(4) Halkeamasaumat olivat 7.2 ja 3.2 yksikköä leveitä ilman mitään
kaistarajoitusta.** Etualan jälkeen se on alle pikselin: verkosto kirkkaita
alipikselin viivoja lähes mustan basaltin päällä. Alipikselin kirkas viiva ei
liiku liikkuvan kameran alla — se kimaltaa. Jokainen sauma levennetään nyt
vähintään **oman pikselijalanjälkensä** kokoiseksi (`dFdx/dFdy` maailmapaikasta
— se on oikea muuttuja; etäisyys oli sijaismuuttuja, ja viistossa katsottuna
lähipikselin jalanjälki on suurempi kuin kohtisuoraan katsotun kaukopikselin) ja
himmennetään samalla kertoimella. Se on täsmälleen se mitä mip-taso tekee.

**Ja sitten rehellinen osa.** Näiden neljän jälkeen jäljelle jäävä
ruutujenvälinen muutos on **oikeaa kameraliikettä**: mitattuna yhdeksän
pikseliä ruudussa ulostulotarkkuudella sisääntuloajon aikana, erittäin
kontrastisella pinnalla, ilman liike-epäterävyyttä. Jos värinä ei riitä
poistuneen, suorin vipu on `--ss 2` renderöinnissä (aito 2× ylinäytteistys) tai
tuon ajon hidastaminen. Sano kumpi, niin tehdään.

### 2. Aavikon keinunta koko matkalle, ja harjun seuraaminen

*"Keinunta on tosi hyvä. Voisi olla samalla tavalla keinuvaa jatka tästä
eteenpäinkin, ja puoli välissä voitaisiin löyhästi seurata harjun kurvia ja
palata normaalille keinuvalle polulle."*

Suljettu muoto ei kanna tätä. Se toimi avauksessa koska suunta, kallistus ja
sivuttaissiirtymä olivat kolme näkymää **yhteen** liikkeeseen. Se lakkaa
toimimasta heti kun kameran pitää **seurata** jotain: ohjauslailla joka lukee
maastoa edessään ei ole suljetun muodon integraalia.

Polku integroidaan siis **kerran**, konstruktorissa, 60 Hz:n taulukkoon, ja
kaikki lukijat — kamera, katsesuunta, `desert.js`:n feikkiportaalien sijoitus —
lukevat sitä. Tämä **ei** ole se "taulukko luettu eri ruudussa kuin täytetty"
-vika: se täytetään kerran vakioista ja korkeuskentästä, ja luetaan sen jälkeen
puhtaana funktiona t:stä. Kaksi prosessia jotka renderöivät filmin eri puoliskot
rakentavat saman taulukon.

**Keinunta** on avauksen oma `f(s)` toistettuna — mikä on mahdollista koska
`f`, `df` ja `∫f` ovat kaikki tasan nollia jakson molemmissa päissä, joten
jokainen jakso liittyy seuraavaan vaakatasossa, suunnassa ja keskiviivalla
ilman että ajautumaa kertyy. Amplitudi ja suunta jaksoittain jakson indeksin
hajautuksesta, jottei kahdeksantoista tahtia ole sama kahdeksan sekuntia
yhdeksästi.

**Harju** ottaa ohjat puolivälissä (tahdit 165–172). Se lukee maaston 320
yksikköä nykyisen suunnan edestä, ottaa gradientin **oikeasta**
dyynikorkeuskentästä (`desert.js`:n oma `duneHeightAt`, sama jolle se seisottaa
feikkiportaalinsa — ei toista mielipidettä siitä missä hiekka on) ja kääntyy
tangentin suuntaan, joka kulkee harjannetta **pitkin** eikä poikki.

Yksi asia piti mitata: **kontuuri ei ole harju.** Pelkkä tangentti pitää
korkeuden vakiona, mikä on yhtä todennäköisesti notko kuin harjanne —
mitattuna se pudotti kameran alla olevan maan hajonnan 32:sta 23:een mutta
jätti keskiarvon *alemmas* kuin suora ajo. Kolmasosa gradienttia mukaan kävelee
sen harjanteelle ja jää sinne, koska harjanteella gradientti katoaa ja tangentti
on ainoa mikä jää jäljelle. Mitattuna: keskiarvo 128 → 131, hajonta 32 → 28.

**Paluu.** Harjun päästettyä irti suunta vedetään takaisin **keinunnan omalle
käyrälle** eikä nollaan — ero on olennainen: keinunnan aikana ne ovat jo samaa
mieltä, joten termi on nolla eikä keinuntaan kosketa, ja harjun jälkeen se on
ainoa vaikuttava ja vie jäännöksen pois kahden sekunnin aikavakiolla. Mitattuna
2.96° → 0.16° viidessä sekunnissa.

Kallistus tulee integroidusta kääntymisnopeudesta läpi koko kohtauksen, eli
yksi sääntö sekä keinunnalle että harjulle. Mitattu horisontista: ±1.6°…±10.1°,
suurimmat lukemat harjuosuudella.

---

## Korjaus: S7 kaatoi selaimen — keskeisdifferenssit pois

Kyllä, tulivuori on S7, ja kaatuminen oli minun.

Lisäsin edellisellä kierroksella verteksivarjostimeen keskeisdifferenssit
normaalin laskentaan. Ne ovat **oikeampia** — etudifferenssi antaa verteksille
sen solun kaltevuuden joka on sen *vieressä*, ei sen omaa, ja interpoloitu
varjostus vaihtaa siksi kulmakerrointa joka solurajalla. Mutta:

**Ne eivät ostaneet mitään mitattavaa.** Liikekompensoidulla jäännöksellä
maasto meni 8.57:stä 8.41:een — mittarin kohinan sisällä.

**Ja ne maksoivat paljon.** `surfH()` on filmin raskain lauseke: kaksi
verkkotunkeumaa, lohkokenttä ja harjannejuna, ja lähipaikalla vielä hieno
kerros päälle. Kaksi verkkoa kantavat yhdessä **579 000 verteksiä**.
Keskeisdifferenssit nostavat laskennan **kolmesta viiteen** `surfH`-kutsuun per
verteksi — 67 % lisää raskaimpaan varjostimeen. Se riittää laukaisemaan
ajurin vahtikoiran (TDR), joka vie välilehden mukanaan.

**Ja SwiftShader ei kertonut siitä.** Ohjelmistorenderöijässä ei ole
vahtikoiraa — `npm run check` meni läpi, "page errors: (none)". Tämä on uusi
merkintä vikaluetteloon: **ohjelmistorenderöijä ei näe suorituskykyvikoja.**
Se on hidas kaikkeen, joten se on yhtä hidas hyväksyttävään ja
kaatavaan — eikä siis erota niitä.

Palautettu etudifferensseihin, eli verteksikustannus on takaisin siinä missä
se oli ennen kaikkia tämän kierroksen muutoksia. Kolme muuta värinäkorjausta
jäävät voimaan, ja ne ovat kaikki **halvempia** kuin se mitä ne korvasivat:

* `LAVA_FRONT`-vakio poistaa `smoothstep`in ja `length`in jokaisesta
  verteksistä;
* `detailGate(local)` poistaa vähennyslaskun ja `length`in;
* `uRing`-hylkäys **vähentää** piirrettyjä fragmentteja (kaksi verkkoa ei enää
  varjosta samoja pikseleitä);
* saumojen kaistarajoitus lisää kaksi `max`ia ja kaksi jakolaskua
  fragmenttivarjostimeen — mitätön.

Eli S7:n kokonaiskuorman pitäisi nyt olla **pienempi** kuin ennen tätä
kierrosta, ei suurempi.

---

## Korjaus 2: S7:n kaatuminen — derivaatat `discard`in jälkeen

Keskeisdifferenssien poisto ei auttanut, ja se oli oikea johtopäätös väärästä
epäilystä. Todellinen syy on yhden rivin **paikka**.

Lisäsin fragmenttivarjostimeen pikselijalanjäljen:

```glsl
float fp = max(length(dFdx(vWorld.xz)), length(dFdy(vWorld.xz)));
```

ja panin sen **kahden `discard`in jälkeen**.

Ruutuavaruuden derivaatat lasketaan **2×2 fragmenttiruudussa**. Ne ovat siis
määriteltyjä vain sellaisessa haarautumisessa joka on **yhtenäinen koko ruudun
yli**. `discard`in jälkeen ruudusta on voinut pudota kaistoja, ja tulos on
spesifikaation mukaan **määrittelemätön** — käytännössä yksi ajuri palauttaa
roskaa, toinen NaN:in, kolmas jumittuu ja vie välilehden mukanaan. Kolmas oli
tämä.

Rivi on nyt varjostimen **ensimmäinen** lause, molempien `discard`ien
yläpuolella. Kuva on **tavulleen sama** kuin ennen siirtoa, koska SwiftShader
sattui sietämään väärän paikan.

Tarkistin samalla kaikki muut `fwidth`/`dFdx`-käytöt projektissa (dark, jungle,
water, islands, core/glsl) — yhdessäkään ei ole `discard`ia niiden yläpuolella.

**Toinen merkintä samasta asiasta yhden kierroksen aikana:** ohjelmistorenderöijä
sertifioi tämän läpi. Ensin se ei nähnyt suorituskykyvikaa, nyt se ei nähnyt
määrittelemätöntä käytöstä. `npm run check` kertoo että kohtaus **piirtyy** —
se ei kerro että se piirtyy **oikealla näytönohjaimella**.

### Sivumittaus: S7 on filmin raskain kohtaus kertaluokalla

Samalla mitattu, koska se oli epäiltynä: yhden ruudun renderöinti
SwiftShaderissa, sama koko ja sama sekunti kohtauksen sisällä.

| kohtaus | aika/ruutu |
|---|---|
| S7 tulivuori | ~10 s |
| S11 saarekkeet | ~1.1 s |

Kerrostasolla (S7, sama ruutu, `--mute`):

| kerros pois | kokonaisaika |
|---|---|
| — (täysi) | 20.2 s |
| lähipaikka | 14.8 s |
| **karkea maasto** | **9.9 s** |
| pilarit + hiillos | 19.5 s |

Karkea maasto yksin on noin puolet koko kohtauksesta: 620×620 = 385 000
verteksiä, joista jokainen laskee `surfH()`:n kolmesti, ja `surfH()` on filmin
raskain lauseke. Tämä **ei** ole kaatumisen syy — se on nyt korjattu — mutta jos
kohtaus tökkii `npm run dev`:ssä vielä senkin jälkeen, tässä on vipu: verkon
segmenttimäärä 620 → 400 (välistys 19.4 → 30 yksikköä) puolittaisi verteksit,
ja kentän hienoin piirre on 120 yksikön harjannejuna eli sekin saisi yhä neljä
näytettä aallonpituudelta. Se muuttaa hieman kaukosiluettien pehmeyttä, joten
en tehnyt sitä kysymättä.

---

## Korjaus 3: S7 jumittaa — se on paino, ja se on minun

"Jumittaa" eikä "kaatuu" on eri vika, ja mittaus sanoo mikä se on. **S7 on
filmin raskain kohtaus kertaluokalla**, ja lasku on tämän tiedoston omaa
tekoa: kun laavamorfologia rakennettiin uudelleen, karkea taso nostettiin
620 segmenttiin ja sen rinnalle tuli 440 segmentin lähipaikka. Yhdessä
**579 000 verteksiä**, joista jokainen laskee `surfH()`:n kolmesti — ja
`surfH()` on filmin raskain lauseke. Se ei ole bugi, se on lasku.

Kolme leikkausta:

**Taso 12000 → 11400.** Ilmainen. Korkeussumu vie tämän maan utuun 5600
yksikköön mennessä; 12000:n taso ulottuu 8485:een kulmissaan. Ne kulmat
piirsivät jotain mitä kukaan ei voi nähdä.

**Segmentit 620 → 420** (välistys 19.4 → 27.1). Tämä verkko piirtää vain
1250 yksikön ulkopuolelle, ja hienoin asia jota se kantaa on harjannejuna
120 yksikön välein — se saa yhä neljä ja puoli näytettä aallonpituudelta.

**Lähipaikka 440 → 340** (6.8 → 8.8). Sen hienoin asia on `lavaFine()`:n
varpaat, 110 yksikköä leveitä 30 yksikön rintamalla — kolme ja puoli näytettä
rintaman yli.

`LAVA_FRONT` 62 → 85 mukana, koska se on olemassa juuri tätä varten: 85
karkealla 27.1:n hilalla on sama "kolme näytettä rintaman yli" -suhde kuin 62
oli vanhalla 19.4:n hilalla. Verkko saa siis täsmälleen sen mitä se sai ennenkin,
molemmilla välistyksillä.

**Yhteensä 579 000 → 292 000 verteksiä.**

Mitattu hinta ja mitattu haitta:

* kustannus **−45 %** (sama ruutu, sama koko, sama renderöijä)
* kuva liikkui **0.84 tasoa 255:stä** keskimäärin, 1.2 % pikseleistä yli
  kymmenen — ero jota ei löydä ilman kahta ruutua vierekkäin

### Ja välitön kiertotie, jos se yhä tökkii

Esikatselun oikeassa yläkulmassa on resoluutiopainike, joka kiertää
`1× → 1.5× → 2× → 0.75× → 0.5×`. **0.5× on neljäsosa fragmenttikuormasta.**
Se on nopein tapa erottaa "liian raskas" jostain muusta: jos S7 pyörii 0.5×:llä
ja jumittaa 1×:llä, vika on kuormassa ja mittaus yllä on oikeassa. Jos se
jumittaa myös 0.5×:llä, vika on **verteksipuolella tai ajurissa**, ei
fragmenttipuolella — ja sano se, niin seuraava leikkaus menee sinne.

---

## Kierros: neljä havaintoa renderöinnistä

### 1. Aavikon keinunta tärähtelee — harjunseuranta pois

Mitattu suoraan taulukosta, ilman renderöintiä: keinunnan aikana kallistus
muuttuu **0.04–0.15 astetta ruudussa**, ja harjuosuuden sisällä
**kaksikymmentäyksi ja puoli astetta ruudussa**, useita kertoja. Se ei ole
kamera joka seuraa harjua; se on kamera jota heitetään.

Syy on ohjauslaissa itsessään. Se valitsee suunnan gradientin **tangentista**,
ja tangentteja on kaksi — se valitsi sen joka osoittaa eteenpäin. Sillä
hetkellä kun harjanne kulkee kulkusuunnan **poikki** eikä pitkin, tuo testi
kääntyy, halutun suunnan arvo hyppää puoli kierrosta, kääntymisnopeus
saturoituu omaan rajaansa vastakkaiseen suuntaan, ja kallistus lyö
kiinnittimestä toiseen.

Sen vakauttaminen tarkoittaisi takaisinkytkentäsilmukan suodattamista, ja se
mitä pyysit nähtyäsi sen on takaisinkytkennän vastakohta: **tasainen keinunta,
sama jonka alku tekee, koko kohtaukselle.** Joten harjunseuranta on poistettu
ja polku on taas suljettu muoto — mikä ei ole lohdutuspalkinto. Suljettu muoto
ei voi tärähdellä, ei riipu siitä millä taajuudella se integroitiin, ja vastaa
missä kamera on millä tahansa t:llä ilman taulukkoa, mitä `desert.js` tarvitsee
seisottaakseen feikkiportaalinsa hiekalle.

Mitattu jälkeen: **5.5° suuntaa, 7.5° kallistusta, enintään 0.13° kallistuksen
muutosta ruudussa** (oli 21.5), ja jokainen jakson raja tasan vaakatasossa,
suunnassa ja keskiviivalla.

Jos haluat harjun takaisin joskus, se on tehtävissä — mutta se vaatii oikean
suodattimen eikä kiinnitintä, ja se on oma kierroksensa.

### 2. Tulivuoren rinteen "suoni" — päällekkäisyys, kuten arvelit

Olit oikeassa: siellä oli jotain päällekkäistä, ja se oli minun jättämäni.

Edellinen korjaus jätti **neljänkymmenen yksikön tahallisen limityksen**
kahden maastoverkon väliin ja antoi lähipaikan voittaa sen syvyyssiirtymällä.
Perustelu oli oikea rakosta ja väärä lääkkeestä: syvyyssiirtymä voittaa
**kiinteällä** biasilla, ja kartion rinteellä kaksi hilaa (27 ja 8.8 yksikköä)
rekonstruoivat pinnan **metrien** päähän toisistaan. Se kaista on siis rengas
kiistanalaisia pikseleitä **kiinteällä etäisyydellä kamerasta**, joka pyyhkii
vuorenrinnettä kameran liikkuessa — ja se näyttää suonelta joka vilkkuu.

Nyt säteet ovat **tasan samat**. Testit ovat komplementaariset: karkea taso
piirtää kun rCam ≥ 1250 ja lähipaikka kun rCam ≤ 1250, joten yhtään pikseliä ei
kiistetä paitsi se yksi rivi jossa verkkojen omat interpoloidut maailmapaikat
ovat eri mieltä rajasta itsestään. Syvyyssiirtymä jää ratkaisemaan sen rivin.

### 3. Lentävät lehdet — puhdistettu käytävä oli väärällä puolella

Latvustokuvassa kamera astuu keskiviivalta sivuun (se oli korjaus
peilisymmetriseen kuvaan), ja se astuu **aina samaan suuntaan**: sivuttaissiirto
on `high*(6.2 + 3.4*sin)`, eli 2.8–9.6 yksikköä **oikealle** eikä koskaan
negatiivinen. Puhdistettu suppilo taas avautuu `x = 0`:n ympärille 0.115
yksikköä korkeusyksikköä kohti — **3.6 yksikköä leveä** latvustokorkeudella.

Eli kamera vietti koko kuvan **kuusi yksikköä puhdistetun kuilun ulkopuolella**,
lentäen lehtikentän läpi, ja jokainen lehti jonka läpi se meni työnnettiin
sivuun verteksivarjostimen siirtymällä. Se on "lentelevät lehdet".

Symmetrinen puhdistus veisi kaksinkertaisen määrän lehviä turhaan, koska
vasemmalla ei ole koskaan mitään siellä ylhäällä. Joten **oikea puoli avautuu
0.62:lla ja vasen pitää 0.115:n**. Latvustokorkeudella se on 13.4 yksikköä
tilaa kameraa vasten joka yltää 9.6:een, ja kuvan vasen puoli — jota kohtaus
enimmäkseen katsoo — on yhtä tiheä kuin ennenkin.

### 4. Tunneli hyppäsi polulle — nyt se saapuu

`Tunnel.update` saa `from`-parametrin: etäisyys jolla käytävä **alkaa**.
Pyyhkäistään 520 yksiköstä −30:een kahden tahdin aikana, joten kaukaisimmat
renkaat nousevat ensin ja käytävä rakentuu takaisin kameraa kohti.

Se mitä ennen tehtiin — rampataan jokaisen renkaan kirkkaus yhdessä — on
ristikuva tunnelin vaatteissa: koko esine ilmestyy kerralla, joka etäisyydellä,
mikä on se yksi asia jota lähestyvä esine ei koskaan tee.

Kaksi asiaa piti mitata:

* **Alue.** Ensimmäinen yritys pyyhkäisi 6200:sta — kauempaa kuin käytävä on
  näkyvissä. Sekä renkaat että juovat vaimenevat kuin `1/(1 + ahead*0.006)`,
  joten ~500 yksikön takana ei ole enää mitään piilotettavaa; pyyhkäisy ei
  siis tehnyt mitään suurimman osan matkastaan ja paljasti sitten kaiken
  kerralla — juuri se äkillisyys jota sen piti korjata.
* **Juovat.** Renkaiden portitus yksin jätti saapumisen yhtä äkilliseksi,
  koska ruudun täyttävät pitkät säikeet ovat juovia eivätkä renkaita. Ne
  portitetaan nyt samalla pyyhkäisyllä.

Kaikki neljä tarkistettu: `npm run check` läpi, ja S5, S7 ja S17 puhtaus
tarkistettu (tavulleen sama kahdessa eri selainistunnossa).

---

## Korjaus: 01:52:n "suoni" — se on tunnelirengas, ei tulivuori

Ensin paikannus, koska se muuttaa asian: **01:52 ei ole tulivuorikohtaus.**
S7 alkaa 115.8 s eli 01:56. Kohta 112 s on **S6, toinen tunneli**. Renderöin
sen 10 ruutua sekunnissa ja katsoin, enkä päätellyt.

Ja siellä se on. Renkaat, jotka ohittavat kameran, näkyvät parin ruudun ajan
**paksuina läpinäkymättöminä putkina** jotka pyyhkäisevät sisään vasemmalta.
Se on se suoni.

**Syy:** kaarilla oli tiedoston ainoana kerroksena **ei lainkaan lähihäivytystä.**

* sumu häivyttyy `smoothstep(6, 55, ahead)`
* juovat häivyttyvät `(ahead - 14)/55`
* **kaaret häivyttyivät vasta välillä −26 … 0**

Eli kaari oli **täydessä kirkkaudessaan sillä hetkellä kun se saavutti
objektiivin**, ja himmeni vasta kun se oli jo takana. Kaari sillä hetkellä on
18–22 yksikön säteinen rengas akselin ympärillä. Jos kamera on akselilla, se on
vanne ruudun reunalla eikä kukaan huomaa. Mutta **jokainen tämän filmin käytävä
vie kameran tahallaan pois akselilta** — se oli oma korjauksensa aikanaan — ja
silloin vanteen lähireuna ohittaa muutaman yksikön päästä linssiä ja peittää
suurimman osan kuvasta. Aina samalla puolella jolle kamera on siirretty:
*"vasemmalla noin puolen sekunnin välein"*.

Kaaret häivyttyvät nyt samalla ikkunalla kuin muut kaksi kerrosta. Rengas
saapuu ja ohittaa edelleen; se lakkaa olemasta kiinteä esine joka vedetään
linssin yli matkalla.

Mitattu, toisen tunnelin yli 10 fps:llä: ruudun vasemman kolmanneksen kirkas
osuus **0.207 huipussaan, kaksi piikkiä → 0.065, ei yhtään**. Tarkistettu
etteivät S4, S10 ja S16 menetä käytävän lukua — renkaat suppenevat
katoamispisteeseen kuten ennenkin.

**Huom:** jos tulivuoren *rinteillä* näkyy vielä erikseen värinää, se on eri
asia kuin tämä ja tarvitsen siihen ajan väliltä **01:56–02:07** (S7:n oma
kesto). Nyt korjattu on se mitä 01:52 kohdalla oikeasti tapahtuu.

---

## Kierros: seitin sauma — ja mittaus joka sanoo että vika on esikatselussa

Kuvaruutukaappaus antoi sen mitä arvaus ei: **118.62 s, tahti 71.3, S7,
"Ash"-kuva, 31 fps.** Eli tulivuori sittenkin, seitsemän sekuntia myöhemmin
kuin arvioitu aika.

### Korjattu: verkkojen sauma repi vuorta

Edellinen korjaukseni asetti säteet tasan samoiksi ja poisti z-tappelun.
Se ei riittänyt, ja syy on hienovarainen: **kumpikin verkko päättää kummalla
puolella rajaa pikseli on OMASTA interpoloidusta maailmapaikastaan.** Missä
pinnat ovat eri mieltä, rajat eivät osu yhteen — ja sitä käyrää pitkin on
kaistale jossa **molemmat hylkäävät**. Siinä ei piirretä mitään: taivas näkyy
vuoren läpi. Se on tumma käyrä joka ilmestyy ja katoaa rajan pyyhkiessä, ja
pystysuora repeämä siellä missä se kulkee kaatosuuntaa alas. *"Repii
tulivuorta pystysuunnassa."*

Korjaus on se jota jokainen clipmap-maasto käyttää: **lähipaikka morfaa
karkean verkon pinnalle** viimeisen 240 yksikön matkalla — kenttä
näytteistettynä karkealla hilalla ja bilineaarisesti interpoloituna, mikä on
täsmälleen se mitä ulkopuolinen taso piirtää. Saumalla pinnat ovat siis
identtiset, eikä ole enää mitään mistä olla eri mieltä: ei rakoa, eikä mitään
minkä syvyysbias joutuisi ratkaisemaan.

Neljä ylimääräistä arviointia, ja vain sen renkaan verteksseille — noin
viidennes lähipaikasta, alle kymmenesosa kohtauksesta. Kuva muuttui
keskimäärin 0.096 tasoa.

### Mittaamatta jäi: "suoni" ei toistu renderöijässä

Renderöin täsmälleen sen ikkunan **sinun omalla resoluutiollasi** (1920×1080)
ja sinun ruutunopeudellasi:

```
118.550  rinne 100.04
118.583  rinne  99.98
118.617  rinne  99.92     <- sinun ruutusi
118.650  rinne  99.84
118.683  rinne  99.78
118.717  rinne  99.72
```

Monotoninen lasku 0.3 tasoa kuudessa ruudussa. Ruutujenvälinen ero keskimäärin
**1.6 tasoa**, ja **0.01 %** pikseleistä yli 40:n. Ei välähdystä, ei tummaa
kaistaa, ei mitään.

Sama 960×540:llä kolmentoista ruudun yli 118.40–118.80: sama tulos.

**Eli se mitä näet kohdassa 118.62 ei ole renderöidyssä kuvassa — se on
esikatselussa.** Ero näiden välillä on kolme asiaa: esikatselu ajaa
reaaliajassa (HUD sanoo 31 fps eli se pudottaa joka toisen ruudun), sen `t`
tulee **äänielementin kellosta** joka etenee epätasaisin askelin, ja se piirtää
ilman `preserveDrawingBuffer`ia. Renderöijä antaa jokaiselle ruudulle oman
tarkan ajan tasavälein.

### Ja sitten mitattu oikeilla asetuksilla

Kerroit että molemmat artefaktit näkyvät myös `npm run film` -renderöinnissä
2560×1440@60. Se muuttaa tulkinnan, ja järkevään suuntaan: **geometrinen sauma
näkyy sitä paremmin mitä KORKEAMPI resoluutio on**, ei huonommin. Askel
pinnassa on kiinteä maailmassa, joten se peittää enemmän pikseleitä isommassa
kuvassa — kun taas laskostuminen menee toisin päin. Mittasin siis liian
matalalla resoluutiolla, ja sen takia keskiarvoni ei nähnyt mitään.

Renderöity uudestaan **2560×1440, 60 fps**, samat asetukset kuin `npm run
film`, kohdassa 118.60–118.65, **geomorfaus paikallaan**:

* ruutujenvälinen ero **0.52 tasoa** keskimäärin
* **0.012 %** pikseleistä yli 30:n
* rinne 1:1-rajauksessa: ei repeämää, ei tummaa suonta

**Mutta:** sinun mp4:si on renderöity ennen tämän päivän saumatyötä. En voi
todistaa mitään sitä vasten. Aja `npm run film` uudelleen — jos repeämä ja
suoni ovat poissa, sauma oli molempien syy. Jos jompikumpi jää, ota
ruutukaappaus **mp4:stä** (ei esikatselusta) ja sen aika, niin minulla on
sama kuva jota katsoa kuin sinulla.

---

## Korjaus: "renderöinti ei lähde käyntiin" — argumentit eivät tulleet perille

Toistettu: **ilman `--from`/`--to` `render.mjs` renderöi tasan yhden ruudun ja
lopettaa**, noin sekunnissa. Ulkopuolelta se on erottamaton renderöijästä joka
ei käynnistynyt.

Arvasin syyksi PowerShellin `--`-käsittelyn. **Se arvaus oli väärä** —
`npm run render -- --from/--to` on toiminut samalla koneella aiemmin, ja
`npx vite build` + `node render.mjs --from ... --to ...` ei lähde sekään,
vaikka siinä ei ole `--`-erotinta eikä npm:ää välissä. En siis tiedä syytä, ja
lakkasin päättelemästä sitä ilman virhetekstiä.

Mitä tiedän: `npm run film` toimii, ja se on `vite build && node render.mjs
--from 0 --to 293.41 --out gateway.mp4` — sama node-kutsu eri luvuilla.

Käytännön ratkaisu on siis sama mekanismi jonka tiedetään toimivan: **alueet
`package.json`iin** eikä komentoriville. Lisätty `volcano`, `volcano-png` ja
`ending`.

Lisätty varoitus: jos aikaväliä ei annettu, skripti **sanoo sen** eikä teeskentele
tekevänsä työtä. Sama vikaluokka kuin aiemmin kirjattu *"debug-työkalu joka
raportoi onnistumisen tekemättä mitään"* — työkalun joka ei tee mitään on
sanottava se.

---

## Ja sitten se paljastui: kyse ei ollut argumenteista lainkaan

Ratkaiseva tieto tuli yhdellä lauseella: **`npm run ending` toimii, `npm run
volcano` ei.**

```
film     --from 0    --to 293.41   toimii
ending   --from 249  --to 292.5    toimii
volcano  --from 115  --to 128      EI TOIMI
```

Sama komento, sama muoto, sama tiedosto — vain aikaväli eroaa. Argumentit
tulevat siis perille. **Välillä 115–128 on tasan yksi asia: S7.**

Sama kohtaus joka kaatoi selaimen `npm run dev`:ssä. Sama kohtaus joka mitattiin
kertaluokkaa kalliimmaksi kuin mikään muu. `ending` ei koske siihen, `film`
renderöitiin ennen tämän päivän muutoksia.

**Eli S7 kaataa myös offline-renderöijän, ei vain esikatselua.** Se on eri
väite kuin mitä tänään päättelin, ja se kumoaa aiemman "kaatuminen korjattu"
-johtopäätökseni: verkon puolitus ei riittänyt.

Ja kaikki kolme kierrosta joilla tätä on jahdattu — PowerShellin `--`,
argumenttien välitys, `node` vs `npm` — olivat väärää puuta. Ne olivat
uskottavia selityksiä oireelle ("ei lähde käyntiin"), eivätkä yksikään niistä
ollut testattavissa ilman virhetekstiä. Oikea kysymys olisi ollut ensimmäisenä:
**mikä muu komento toimii?** Yksi toimiva vertailukohta erotti sen mitä kolme
kierrosta arvailua ei.

### Tikapuut, joilla seuraava askel on mitattavissa

```
npm run volcano-still   yksi ruutu 2560x1440, ei videopolkua lainkaan
npm run volcano-lo      sama aikaväli 640x360, yksi prosessi
npm run volcano         täysi 2560x1440
```

* `volcano-lo` toimii, `volcano` ei → kohtaus on liian raskas täydellä
  resoluutiolla, ja leikataan lisää (verkot ovat 292 000 verteksiä; niistä saa
  vielä puolet pois näkymättä).
* `volcano-still` toimii, `volcano-lo` ei → vika on videopolussa eikä
  kohtauksessa.
* mikään ei toimi → vika on kohtauksen omissa varjostimissa.

---

## Ja lopulta: renderöijä ei ollutkaan jumissa

Kolme oiretta, kaikki samasta syystä — eikä yksikään niistä ollut vika
kohtauksessa.

Toistin `volcano-lo`:n täällä ja sain **täsmälleen samat oireet kuin sinä**:
`frame= 0 fps=0.0`, ei etenemistä, ja `volcano-lo.mp4.part0.mp4` kooltaan
**48 tavua**. Samaan aikaan lokissa luki, yhden kerran ja sitten pyyhkiytyneenä:

```
frame 25/781  0.5 fps  eta 1584s
```

Renderöijä siis teki työtään koko ajan.

**1. `frame= 0 fps=0.0` on ffmpeg, ei renderöijä.** x264 tällä presetillä
puskuroi noin viisikymmentä ruutua ennen kuin se päästää ulos yhdenkään
(`rc_lookahead=50`, `bframes=3`). Ensimmäisen minuutin ajan se raportoi
rehellisesti nollaa.

**2. 48 tavua on mp4:n otsake.** Se kirjoitetaan heti, ja pysyy sen kokoisena
kunnes ensimmäinen enkoodattu ruutu valmistuu.

**3. Ja renderöijän oma edistymisrivi katosi.** ffmpeg tulostaa tilastonsa
sekunnin välein samalle riville `\r`:llä. Se ylikirjoittaa tämän skriptin oman
rivin — sen ainoan joka kertoo totuuden.

Kolme toisistaan riippumatonta signaalia, kaikki sanovat "kuollut", ja
kaikki väärässä.

**Korjattu:** ffmpeg saa `-nostats -loglevel error`. Tilastot pois, oikeat
virheet jäävät. Ruudulla on nyt tasan yksi edistymisrivi ja se on tosi:

```
frame 25/781  0.3 fps  eta 2366s
```

Sama vikaluokka kolmatta kertaa tässä projektissa: **työkalu joka näyttää
tekevän jotain muuta kuin tekee.** Ensin debug-työkalu joka raportoi
onnistumisen tekemättä mitään, sitten renderöijä joka teki yhden ruudun ja
lopetti hiljaa, nyt renderöijä joka teki työtään näyttäen kuolleelta.

### Mitä tämä EI selitä

`npm run dev` kaatuu S7:ssä. Se on eri asia kuin tämä, se on yhä auki, ja
`volcano-still`:in toimiminen kertoo että kohtaus piirtyy kertaruutuna
2560×1440:llä ilman ongelmaa. Seuraava tieto jota tarvitsen on se, eteneekö
`frame N/781` nyt sinun koneellasi — jos etenee, renderöinti ei ollut koskaan
rikki ja jäljellä on vain dev-tilan kaatuminen omana ongelmanaan.

---

## S7: mikä oikeasti oli vialla, ja mikä ei

Sinun ajoituksesi ("meni rikki noin 50 min sitten, geomorfaus") oli oikea tapa
kysyä, mutta mittaus sanoo toista, ja koko ketjun opetus on siinä.

### Todiste: kustannus on VERTEKSEISSÄ, ei fragmenteissa

Yksi ruutu 2560×1440 ja yksi ruutu **320×180** — kuudeskymmenesneljäsosa
pikseleistä — vievät **saman ajan**. Se on ainoa mittaus jota tarvittiin, ja se
kumoaa kaksi kokonaista kierrosta: resoluution laskeminen ja fragmenttipuolen
vian etsiminen eivät olisi voineet koskaan näyttää mitään, koska 292 000
verteksiä × kolme `surfH()`-kutsua on sama työ olipa ruutu minkä kokoinen
tahansa.

Se selittää myös miksi oire näytti juuri siltä miltä näytti:

* `volcano-still` toimii — **yksi** hidas ruutu on siedettävä
* `volcano-lo` ei — **781** yhtä hidasta ruutua ei ole
* ja oikealla näytönohjaimella yhden piirtokutsun kesto voi ylittää ajurin
  vahtikoiran suoraan, mikä on `npm run dev`:n kaatuminen

### Kaksi asiaa jotka näyttivät viasta mutta eivät olleet

**ffmpeg** raportoi `frame= 0 fps=0.0` ensimmäisen minuutin, koska x264
puskuroi ~50 ruutua ennen kuin päästää yhdenkään ulos, ja sen tilastorivi
ylikirjoitti renderöijän oman rivin. Korjattu: `-nostats -loglevel error`.

**Edistymisrivi tulostui joka 25. ruudulla.** Kuusikymmentä ruutua sekunnissa:
hyvä. Yksi ruutu kolmessa sekunnissa: rivi ilmestyy kerran ja on sitten hiljaa
minuutin. Se on erottamaton pysähtymisestä, ja se raportoitiin pysähtymisenä —
kahdesti, kahden eri ihmisen katsomana, samasta tulosteesta. **"Pysähtyy frame
25/781" oli tulostusväli.** Korjattu: rivi päivittyy kellon mukaan sekunnin
välein ja näyttää myös kuluneen ajan.

Kolmas kerta tässä projektissa samalle vikaluokalle: *työkalu joka näyttää
tekevän jotain muuta kuin tekee.*

### Tehty

Verteksibudjetti **292 000 → 148 000** (segmentit 420→300 ja 340→240,
`LAVA_FRONT` 85→118 hilan mukana, koska se on olemassa juuri pitämään askel
leveämpänä kuin verkko pystyy näytteistämään). Alkuperäisestä 579 000:sta se on
**−74 %**.

Kuva liikkui keskimäärin **0.83 tasoa 255:stä**, 0.95 % pikseleistä yli
kymmenen.

### Otettu pois

Sauman geomorfaus. Se on **oikea korjaus** siihen repeämään, mutta se maksaa
neljä ylimääräistä korkeuslaskentaa jokaista rengasverteksiä kohti kohtauksessa
jota ollaan juuri saamassa ajettavaksi. Se palaa halvemmassa muodossa
(uloimman rengasrivin naulaaminen karkean hilan pisteisiin, yksi lisälaskenta
neljän sijaan) kun tiedämme että kohtaus pyörii.

---

## Paluu viimeiseen toimivaan tilaan

Tunnistit viimeisen täysin toimivan commitin sen saatetekstistä. Se on tämän
koko ketjun hyödyllisin tieto, ja käytin sitä suoraan sen sijaan että olisin
päätellyt lisää.

Siinä commitissa `volcanic.js`:ssä oli **420 ja 340 segmenttiä ja
`LAVA_FRONT` 85**, ja S7 sekä pyöri esikatselussa että renderöityi. Kaikki mikä
tämän tiedoston osalta on tapahtunut sen jälkeen — sauman geomorfaus ja verkon
toinen puolitus — tähtäsi kaatumiseen jota nuo luvut eivät todistettavasti
aiheuttaneet. Ne palautettiin täsmälleen. Ainoa koodiero nykyiseen on
geomorfausblokin poisto; kaikki muu on kommenttia.

### Kaksi asiaa joissa olin väärässä

**Verteksimäärä ei ollut syy.** Se oli *suurempi* commitissa joka toimi. Toinen
puolitus (292 000 → 148 000) hoiti oiretta jota ei ollut ja maksoi kuvanlaatua
tyhjästä. Peruttu.

**Mutta mittaus jonka tein sen tueksi pitää yhä paikkansa:** kohtauksen
kustannus on verteksipuolella eikä laske resoluution mukana — yksi ruutu
2560×1440 ja yksi 320×180 vievät saman ajan. Se on totta ja hyödyllistä tietää;
se ei vain ollut vastaus tähän kysymykseen. Väärä johtopäätös oikeasta
mittauksesta.

### Mitä jää voimaan

Mikään näistä ei koske S7:n varjostimia:

* `tunnel.js` — renkaiden lähihäivytys (01:52:n suoni)
* `render.mjs` — ffmpeg hiljennetty, edistymisrivi kellolle, **ja
  ruutukohtainen vahtikoira**: jos ruutu ei valmistu 60 sekunnissa, ajo
  keskeytyy ja kertoo miksi
* `main.js` — **kadonnut WebGL-konteksti ilmoittaa itsestään**

Se viimeinen on se jota koko ajan tarvittiin. Kun ajuri nollaa kontekstin liian
pitkän piirtokutsun takia, kaikki sen jälkeen vain lakkaa toimimasta: ei
poikkeusta, ei virhettä, ei paluukoodia. Esikatselu jäätyy viimeiseen ruutuunsa
ja renderöijä odottaa ruutua joka ei koskaan tule. Nyt se sanoo sen ääneen.

### Ja rehellisesti: repeämä on taas siellä

Geomorfaus oli oikea korjaus saumaan ja se on nyt pois. Se on tietoinen
vaihtokauppa — ajettava kohtaus ennen kaunista saumaa — ja se palaa
halvemmassa muodossa kun tiedämme mikä kaataa.

### Täysi paluu, ja järjestys jolla jatketaan

Pyysit palauttamaan koko version ja korjaamaan sen jälkeen ongelmat yksitellen
ilman arvailua. Tehty.

**Palautettu kuvaan vaikuttavista tiedostoista täsmälleen se commit:**

* `src/env/volcanic.js` — 420/340 segmenttiä, `LAVA_FRONT` 85, ei geomorfausta
* `src/env/tunnel.js` — renkaiden lähihäivytys pois, takaisin `(ahead+26)/26`

Molemmat ovat nyt koodiltaan identtiset sen commitin kanssa; ainoa ero on
kommentit jotka kertovat mitä yritettiin ja miksi se peruttiin.

**Jätetty voimaan vain mittalaitteet.** Nämä eivät piirrä mitään eivätkä muuta
yhtään ruutua — ne vain kertovat mitä tapahtuu:

* `render.mjs` — ffmpegin tilastot hiljennetty, edistymisrivi päivittyy joka
  sekunti kuluneen ajan kanssa, ja ruutukohtainen 60 sekunnin vahtikoira joka
  keskeyttää ja kertoo syyn sen sijaan että jäisi odottamaan ikuisesti
* `src/main.js` — kadonnut WebGL-konteksti ilmoittaa itsestään
* `package.json` — `volcano`, `volcano-lo`, `volcano-still`, `ending`

Jos haluat nekin pois, sano — mutta ilman niitä seuraava kierros alkaa taas
siitä ettei kukaan näe mitä tapahtuu.

### Jono, yksi kerrallaan

1. **S7 kaataa selaimen esikatselussa.** Tämä ensin, koska se estää kaiken
   muun katselun. Ensimmäinen askel ei ole korjaus vaan tieto: aja S7
   esikatselussa ja katso tuleeko konsoliin `WEBGL CONTEXT LOST`. Se erottaa
   ajurin nollauksen kaikesta muusta, ja se on kysymys jota en ole koko iltana
   pystynyt näkemään.
2. **Tulivuoren sauma repii pystysuunnassa.** Geomorfaus oli oikea korjaus;
   se palaa halvemmassa muodossa kun 1 on ratkaistu.
3. **01:52 renkaan "suoni".** Lähihäivytys oli mitattu ja toimiva; se palaa
   omana muutoksenaan.

Ja yksi sääntö tälle jonolle: **yksi muutos kerrallaan, ja jokaisen jälkeen
tieto siitä toimiiko S7 esikatselussa.** Tänään kolme muutosta meni sisään
ennen kuin kukaan tiesi mikä niistä rikkoi mitä.

---

## `npm run film` kaatui muistiin — ja vastaus kysymykseesi

Kysyit miksi render toimi 3,5 tuntia sitten. Se on oikea kysymys ja sillä on
täsmällinen vastaus: **koska vahtikoiraa ei silloin ollut.**

`render.mjs`:ään tuli tänä iltana neljä muutosta: ilmoitus puuttuvasta
aikavälistä, ffmpegin tilastojen hiljennys, edistymisrivin kellotus, ja
**ruutukohtainen vahtikoira**. Kolme ensimmäistä eivät varaa mitään ruutua
kohti. Neljäs varaa.

```
frame 1012/17606  26.48 fps  elapsed 38s
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

`guard` määritellään **silmukan rungon sisällä**, samassa lohkonäkyvyydessä kuin
ruudun oma data. V8 varaa yhden kontekstiobjektin näkyvyysaluetta kohti, joten
ajastimen sulkeuma — joka tarvitsee `n`:n viestiinsä — pitää kiinni koko siitä
kontekstista, ja ruudun base64-data on siinä. Jokainen ruutu naulasi siis yhden
kokonaisen ruudun kuudenkymmenen sekunnin ajaksi. 4 MB × 26.5 ruutua sekunnissa
= 106 MB/s, ja Noden neljän gigatavun raja täyttyy 38 sekunnissa. Molemmat luvut
ovat lokistasi.

### Ensimmäinen todistusyritykseni epäonnistui, ja se oli testin vika

Rakensin eristetyn toisinnon ja se **ei vuotanut** — olin valmis hylkäämään koko
selityksen. Testi oli väärin: se määritteli `guard`in silmukan **ulkopuolella**,
mikä poistaa juuri sen näkyvyysalueen jakamisen joka vuodon aiheuttaa. Siirsin
sen sisään, ja sama testi menee 60 megatavusta **1245 megatavuun** kolmensadan
ruudun aikana. Neljä megatavua ruutua kohti, tasan.

Melkein hylkäsin oikean selityksen väärän testin perusteella. Se on saman
vikaluokan uusi muoto kuin koko ilta: **mittaus joka ei mittaa sitä mitä
luulee.**

### Korjaus on yksi rivi, ja monimutkaistus otettiin pois

`clearTimeout` ajastimelle. Siinä kaikki.

Olin lisännyt `film-safe`-skriptin — pienempi preset, vähemmän prosesseja,
isompi keko — eli kolme yhtäaikaista kiertotietä bugille jota en ollut vielä
ymmärtänyt. Kyseenalaistit sen aiheellisesti. Se on poistettu, samoin
`volcano-lo` ja `volcano-still`, jotka olivat tämän illan diagnostiikkatikapuita
eivätkä kuulu projektiin. `npm run film` on taas se komento joka tekee filmin.
