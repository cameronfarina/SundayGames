import type { Position } from "../../config/league.js";
import { canonicalPlayerIdentityKey } from "./normalizePlayerName.js";

export interface EspnPpr300AuctionBaselineValue {
  overallRank: number;
  position: Position;
  positionRank: number;
  name: string;
  normalizedName: string;
  teamAbbreviation: string;
  auctionValue: number;
  byeWeek: number;
}

const sourceRoster = Object.freeze({
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  K: 1,
  DST: 1,
  BENCH: 7,
});

export const espnPpr300AuctionBaseline2026Source = Object.freeze({
  provider: "ESPN",
  title: "2026 ESPN Fantasy Football Draft Kit - PPR Top 300 Cheat Sheet",
  url: "https://g.espncdn.com/s/ffldraftkit/26/NFL26_CS_PPR300.pdf?adddata=2026CS_PPR300",
  lastUpdated: "2026-08-13",
  scoring: "ppr",
  receptionPoints: 1,
  teamCount: 10,
  salaryCap: 200,
  roster: sourceRoster,
} as const);

// overall rank | position | position rank | player | NFL team | ESPN value | bye
const rawEspnPpr300AuctionBaseline2026 = `1|RB|1|Jahmyr Gibbs|DET|57|6
2|RB|2|Bijan Robinson|ATL|56|11
3|WR|1|Ja'Marr Chase|CIN|56|6
4|WR|2|Puka Nacua|LAR|55|11
5|WR|3|Jaxon Smith-Njigba|SEA|54|11
6|RB|3|Christian McCaffrey|SF|53|8
7|RB|4|Jonathan Taylor|IND|52|13
8|WR|4|Amon-Ra St. Brown|DET|52|6
9|WR|5|CeeDee Lamb|DAL|51|14
10|RB|5|De'Von Achane|MIA|50|6
11|WR|6|Justin Jefferson|MIN|48|6
12|RB|6|James Cook III|BUF|46|7
13|RB|7|Jeremiyah Love|ARI|45|14
14|WR|7|Drake London|ATL|43|11
15|RB|8|Ashton Jeanty|LV|42|13
16|WR|8|Rashee Rice|KC|40|5
17|TE|1|Trey McBride|ARI|38|14
18|RB|9|Saquon Barkley|PHI|37|10
19|RB|10|Derrick Henry|BAL|36|13
20|RB|11|Chase Brown|CIN|35|6
21|RB|12|Kenneth Walker III|KC|34|5
22|RB|13|Breece Hall|NYJ|33|13
23|RB|14|Omarion Hampton|LAC|32|7
24|TE|2|Brock Bowers|LV|32|13
25|WR|9|Nico Collins|HOU|31|8
26|WR|10|Garrett Wilson|NYJ|30|13
27|WR|11|A.J. Brown|NE|30|11
28|WR|12|Chris Olave|NO|29|8
29|WR|13|George Pickens|DAL|28|14
30|RB|15|Josh Jacobs|GB|27|11
31|RB|16|Javonte Williams|DAL|26|14
32|WR|14|Malik Nabers|NYG|25|8
33|WR|15|Tetairoa McMillan|CAR|24|5
34|WR|16|Zay Flowers|BAL|23|13
35|WR|17|DeVonta Smith|PHI|22|10
36|QB|1|Josh Allen|BUF|22|7
37|RB|17|Kyren Williams|LAR|22|11
38|RB|18|Travis Etienne Jr.|NO|21|8
39|RB|19|Cam Skattebo|NYG|21|8
40|RB|20|Quinshon Judkins|CLE|20|11
41|RB|21|Bucky Irving|TB|19|10
42|WR|18|Emeka Egbuka|TB|19|10
43|WR|19|Davante Adams|LAR|18|11
44|WR|20|Ladd McConkey|LAC|17|7
45|WR|21|Terry McLaurin|WAS|17|7
46|WR|22|Tee Higgins|CIN|15|6
47|WR|23|Jaylen Waddle|DEN|15|10
48|WR|24|Jameson Williams|DET|14|6
49|TE|3|Colston Loveland|CHI|13|10
50|TE|4|Tyler Warren|IND|13|13
51|WR|25|Carnell Tate|TEN|12|9
52|WR|26|Rome Odunze|CHI|11|10
53|WR|27|Luther Burden III|CHI|11|10
54|WR|28|DJ Moore|BUF|10|7
55|QB|2|Jayden Daniels|WAS|10|7
56|QB|3|Lamar Jackson|BAL|10|13
57|QB|4|Drake Maye|NE|10|11
58|QB|5|Jalen Hurts|PHI|9|10
59|RB|22|Bhayshul Tuten|JAC|9|7
60|RB|23|D'Andre Swift|CHI|9|10
61|RB|24|TreVeyon Henderson|NE|8|11
62|RB|25|David Montgomery|HOU|8|8
63|RB|26|Jadarian Price|SEA|8|11
64|RB|27|Tony Pollard|TEN|7|9
65|WR|29|Courtland Sutton|DEN|7|10
66|WR|30|Michael Pittman Jr.|PIT|7|9
67|WR|31|Alec Pierce|IND|7|13
68|WR|32|Marvin Harrison Jr.|ARI|6|14
69|WR|33|DK Metcalf|PIT|6|9
70|WR|34|Jordyn Tyson|NO|6|8
71|TE|5|Kyle Pitts Sr.|ATL|6|11
72|TE|6|Harold Fannin Jr.|CLE|6|11
73|TE|7|Sam LaPorta|DET|6|6
74|QB|6|Joe Burrow|CIN|5|6
75|QB|7|Jaxson Dart|NYG|5|8
76|WR|35|Mike Evans|SF|5|8
77|WR|36|Parker Washington|JAC|5|7
78|WR|37|Christian Watson|GB|4|11
79|WR|38|Matthew Golden|GB|4|11
80|WR|39|Michael Wilson|ARI|4|14
81|WR|40|Brian Thomas Jr.|JAC|4|7
82|QB|8|Trevor Lawrence|JAC|4|7
83|QB|9|Dak Prescott|DAL|4|14
84|QB|10|Bo Nix|DEN|4|10
85|QB|11|Brock Purdy|SF|4|8
86|QB|12|Matthew Stafford|LAR|4|11
87|QB|13|Caleb Williams|CHI|3|10
88|WR|41|Jakobi Meyers|JAC|3|7
89|WR|42|Wan'Dale Robinson|TEN|3|9
90|WR|43|Josh Downs|IND|3|13
91|WR|44|Jordan Addison|MIN|3|6
92|WR|45|Khalil Shakir|BUF|3|7
93|QB|14|Justin Herbert|LAC|3|7
94|QB|15|Patrick Mahomes|KC|3|5
95|RB|28|Jaylen Warren|PIT|3|9
96|RB|29|Rhamondre Stevenson|NE|2|11
97|RB|30|Rico Dowdle|PIT|2|9
98|RB|31|Kenny Gainwell|TB|2|10
99|RB|32|Chuba Hubbard|CAR|2|5
100|RB|33|Aaron Jones Sr.|MIN|2|6
101|TE|8|George Kittle|SF|2|8
102|TE|9|Tucker Kraft|GB|2|11
103|TE|10|Dallas Goedert|PHI|2|10
104|TE|11|Travis Kelce|KC|2|5
105|RB|34|Rachaad White|WAS|2|7
106|RB|35|Jonathon Brooks|CAR|2|5
107|RB|36|J.K. Dobbins|DEN|2|10
108|RB|37|RJ Harvey|DEN|2|10
109|TE|12|Jake Ferguson|DAL|2|14
110|TE|13|Mark Andrews|BAL|2|13
111|TE|14|T.J. Hockenson|MIN|2|6
112|WR|46|Jayden Reed|GB|2|11
113|WR|47|Makai Lemon|PHI|2|10
114|WR|48|Xavier Worthy|KC|2|5
115|RB|38|Kyle Monangai|CHI|2|10
116|TE|15|Kenyon Sadiq|NYJ|2|13
117|TE|16|Isaiah Likely|NYG|2|8
118|TE|17|Dalton Kincaid|BUF|2|7
119|TE|18|Hunter Henry|NE|2|11
120|RB|39|Jacory Croskey-Merritt|WAS|2|7
121|RB|40|Blake Corum|LAR|1|11
122|RB|41|Woody Marks|HOU|1|8
123|RB|42|Zach Charbonnet|SEA|1|11
124|WR|49|Quentin Johnston|LAC|1|7
125|WR|50|KC Concepcion|CLE|1|11
126|WR|51|Deebo Samuel Sr.|SF|1|8
127|WR|52|Stefon Diggs|WAS|1|7
128|WR|53|Chris Godwin Jr.|TB|1|10
129|WR|54|Romeo Doubs|NE|1|11
130|WR|55|Jayden Higgins|HOU|1|8
131|WR|56|Jalen Coker|CAR|1|5
132|WR|57|Jerry Jeudy|CLE|1|11
133|QB|16|Kyler Murray|MIN|1|6
134|QB|17|Tyler Shough|NO|1|8
135|QB|18|Jared Goff|DET|1|6
136|QB|19|Daniel Jones|IND|1|13
137|RB|43|Jordan Mason|MIN|1|6
138|RB|44|Alvin Kamara|NO|1|8
139|RB|45|Isiah Pacheco|DET|1|6
140|RB|46|Chris Rodriguez Jr.|JAC|1|7
141|RB|47|Brian Robinson Jr.|ATL|1|11
142|RB|48|Tank Bigsby|PHI|1|10
143|WR|58|Rashid Shaheed|SEA|1|11
144|WR|59|Jalen McMillan|TB|1|10
145|WR|60|Calvin Ridley|TEN|1|9
146|WR|61|Denzel Boston|CLE|1|11
147|WR|62|Travis Hunter|JAC|1|7
148|WR|63|Adonai Mitchell|NYJ|1|13
149|QB|20|Baker Mayfield|TB|1|10
150|QB|21|Malik Willis|MIA|1|6
151|WR|64|De'Zhaun Stribling|SF|1|8
152|WR|65|Germie Bernard|PIT|1|9
153|WR|66|Tre Tucker|LV|1|13
154|RB|49|Ray Davis|BUF|1|7
155|RB|50|Tyrone Tracy Jr.|NYG|1|8
156|RB|51|Mike Washington Jr.|LV|1|13
157|RB|52|Tyler Allgeier|ARI|1|14
158|RB|53|Dylan Sampson|CLE|1|11
159|TE|19|Terrance Ferguson|LAR|1|11
160|TE|20|Juwan Johnson|NO|1|8
161|WR|67|Jalen Nailor|LV|0|13
162|WR|68|Omar Cooper Jr.|NYJ|0|13
163|WR|69|Rashod Bateman|BAL|0|13
164|WR|70|Jauan Jennings|MIN|0|6
165|WR|71|Ja'Kobi Lane|BAL|0|13
166|RB|54|Tyjae Spears|TEN|0|9
167|RB|55|Braelon Allen|NYJ|0|13
168|RB|56|Keaton Mitchell|LAC|0|7
169|DST|1|Texans D/ST|HOU|0|8
170|DST|2|Broncos D/ST|DEN|0|10
171|DST|3|Steelers D/ST|PIT|0|9
172|DST|4|Seahawks D/ST|SEA|0|11
173|DST|5|Rams D/ST|LAR|0|11
174|DST|6|Ravens D/ST|BAL|0|13
175|DST|7|Eagles D/ST|PHI|0|10
176|DST|8|Browns D/ST|CLE|0|11
177|DST|9|Patriots D/ST|NE|0|11
178|DST|10|Lions D/ST|DET|0|6
179|DST|11|Chiefs D/ST|KC|0|5
180|DST|12|Chargers D/ST|LAC|0|7
181|K|1|Brandon Aubrey|DAL|0|14
182|K|2|Cameron Dicker|LAC|0|7
183|K|3|Jason Myers|SEA|0|11
184|K|4|Harrison Mevis|LAR|0|11
185|K|5|Ka'imi Fairbairn|HOU|0|8
186|K|6|Eddy Pineiro|SF|0|8
187|K|7|Harrison Butker|KC|0|5
188|K|8|Cam Little|JAC|0|7
189|K|9|Jake Bates|DET|0|6
190|K|10|Tyler Loop|BAL|0|13
191|K|11|Cairo Santos|CHI|0|10
192|K|12|Will Reichard|MIN|0|6
193|RB|57|Jordan James|SF|0|8
194|TE|21|Brenton Strange|JAC|0|7
195|RB|58|James Conner|ARI|0|14
196|RB|59|Justice Hill|BAL|0|13
197|WR|72|Dontayvion Wicks|PHI|0|10
198|QB|22|Jordan Love|GB|0|11
199|QB|23|Cam Ward|TEN|0|9
200|QB|24|C.J. Stroud|HOU|0|8
201|WR|73|Tank Dell|HOU|0|8
202|WR|74|Zachariah Branch|ATL|0|11
203|WR|75|Darnell Mooney|NYG|0|8
204|WR|76|Tre Harris|LAC|0|7
205|WR|77|Ryan Flournoy|DAL|0|14
206|TE|22|Pat Freiermuth|PIT|0|9
207|TE|23|Dalton Schultz|HOU|0|8
208|WR|78|Antonio Williams|WAS|0|7
209|WR|79|Jaylin Noel|HOU|0|8
210|WR|80|Xavier Legette|CAR|0|5
211|WR|81|Jack Bech|LV|0|13
212|RB|60|Jonah Coleman|DEN|0|10
213|RB|61|Kaelon Black|SF|0|8
214|RB|62|Kaytron Allen|WAS|0|7
215|TE|24|Gunnar Helm|TEN|0|9
216|TE|25|Chig Okonkwo|WAS|0|7
217|TE|26|AJ Barner|SEA|0|11
218|QB|25|Sam Darnold|SEA|0|11
219|QB|26|Bryce Young|CAR|0|5
220|QB|27|Fernando Mendoza|LV|0|13
221|RB|63|Nicholas Singleton|TEN|0|9
222|RB|64|Demond Claiborne|MIN|0|6
223|RB|65|Kimani Vidal|LAC|0|7
224|WR|82|Isaac TeSlaa|DET|0|6
225|RB|66|Jaylen Wright|MIA|0|6
226|RB|67|Ollie Gordon II|MIA|0|6
227|WR|83|Chris Bell|MIA|0|6
228|WR|84|Malik Washington|MIA|0|6
229|WR|85|Jalen Tolbert|MIA|0|6
230|WR|86|Cooper Kupp|SEA|0|11
231|WR|87|Caleb Douglas|MIA|0|6
232|WR|88|Kayshon Boutte|NE|0|11
233|WR|89|Brandon Aiyuk|SF|0|8
234|WR|90|Ted Hurst|TB|0|10
235|DST|13|Buccaneers D/ST|TB|0|10
236|DST|14|Packers D/ST|GB|0|11
237|K|13|Chris Boswell|PIT|0|9
238|K|14|Chase McLaughlin|TB|0|10
239|RB|68|Adam Randall|BAL|0|13
240|RB|69|Samaje Perine|CIN|0|6
241|RB|70|LeQuint Allen|JAC|0|7
242|RB|71|MarShawn Lloyd|GB|0|11
243|RB|72|Jaydon Blue|DAL|0|14
244|RB|73|George Holani|SEA|0|11
245|RB|74|Ty Johnson|BUF|0|7
246|RB|75|Emari Demercado|KC|0|5
247|RB|76|Isaiah Davis|NYJ|0|13
248|RB|77|Emmett Johnson|KC|0|5
249|RB|78|Chris Brooks|GB|0|11
250|RB|79|Sean Tucker|TB|0|10
251|RB|80|DJ Giddens|IND|0|13
252|WR|91|Keon Coleman|BUF|0|7
253|WR|92|Savion Williams|GB|0|11
254|DST|15|Jaguars D/ST|JAC|0|7
255|DST|16|Colts D/ST|IND|0|13
256|K|15|Evan McPherson|CIN|0|6
257|K|16|Nick Folk|ATL|0|11
258|TE|27|Greg Dulcich|MIA|0|6
259|TE|28|Darren Waller|CAR|0|5
260|TE|29|Oronde Gadsden|LAC|0|7
261|WR|93|Pat Bryant|DEN|0|10
262|WR|94|Tory Horton|SEA|0|11
263|WR|95|Darius Slayton|NYG|0|8
264|WR|96|Tyquan Thornton|KC|0|5
265|RB|81|Malik Davis|DAL|0|14
266|RB|82|Emanuel Wilson|SEA|0|11
267|QB|28|Geno Smith|NYJ|0|13
268|QB|29|Aaron Rodgers|PIT|0|9
269|QB|30|Jacoby Brissett|ARI|0|14
270|QB|31|Deshaun Watson|CLE|0|11
271|WR|97|Jahan Dotson|ATL|0|11
272|WR|98|Marvin Mims Jr.|DEN|0|10
273|WR|99|KaVontae Turpin|DAL|0|14
274|WR|100|DeMario Douglas|NE|0|11
275|WR|101|Devaughn Vele|NO|0|8
276|RB|83|Will Shipley|PHI|0|10
277|RB|84|Devin Singletary|NYG|0|8
278|RB|85|Tyler Badie|DEN|0|10
279|RB|86|Tahj Brooks|CIN|0|6
280|RB|87|Trevor Etienne|CAR|0|5
281|RB|88|Seth McGowan|IND|0|13
282|RB|89|Kendre Miller|NO|0|8
283|RB|90|Jawhar Jordan|HOU|0|8
284|WR|102|Nick Westbrook-Ikhine|IND|0|13
285|DST|17|Bengals D/ST|CIN|0|6
286|DST|18|Bears D/ST|CHI|0|10
287|K|17|Trey Smack|GB|0|11
288|K|18|Jake Elliott|PHI|0|10
289|TE|30|Cade Otton|TB|0|10
290|TE|31|Mike Gesicki|CIN|0|6
291|TE|32|Evan Engram|DEN|0|10
292|TE|33|David Njoku|LAC|0|7
293|TE|34|Michael Mayer|LV|0|13
294|WR|103|Andrei Iosivas|CIN|0|6
295|WR|104|Ashton Dulin|IND|0|13
296|QB|32|Tua Tagovailoa|ATL|0|11
297|DST|19|49ers D/ST|SF|0|8
298|DST|20|Jets D/ST|NYJ|0|13
299|DST|21|Saints D/ST|NO|0|8
300|DST|22|Vikings D/ST|MIN|0|6`;

const positions = new Set<Position>(["QB", "RB", "WR", "TE", "K", "DST"]);

const integer = (value: string | undefined, label: string): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ESPN PPR Top 300 ${label}: ${value ?? "missing"}.`);
  }
  return parsed;
};

const parseRow = (row: string): EspnPpr300AuctionBaselineValue => {
  const [overallRankValue, positionValue, positionRankValue, name, teamAbbreviation, auctionValueValue, byeWeekValue] = row.split("|");
  if (!positionValue || !positions.has(positionValue as Position)) {
    throw new Error(`Invalid ESPN PPR Top 300 position: ${positionValue ?? "missing"}.`);
  }
  if (!name || !teamAbbreviation) {
    throw new Error(`Invalid ESPN PPR Top 300 player row: ${row}.`);
  }

  return Object.freeze({
    overallRank: integer(overallRankValue, "overall rank"),
    position: positionValue as Position,
    positionRank: integer(positionRankValue, "position rank"),
    name,
    normalizedName: canonicalPlayerIdentityKey(name),
    teamAbbreviation,
    auctionValue: integer(auctionValueValue, "auction value"),
    byeWeek: integer(byeWeekValue, "bye week"),
  });
};

export const espnPpr300AuctionBaseline2026 = Object.freeze(
  rawEspnPpr300AuctionBaseline2026.split("\n").map(parseRow),
);

const espnPpr300AuctionBaseline2026ByName = new Map(
  espnPpr300AuctionBaseline2026.map(player => [player.normalizedName, player]),
);

export const espnPpr300AuctionBaselineValueFor = (
  name: string,
): EspnPpr300AuctionBaselineValue | undefined =>
  espnPpr300AuctionBaseline2026ByName.get(canonicalPlayerIdentityKey(name));
