import { Card, CardContent } from "@/components/ui/card";

const KO = "text-sky-700 dark:text-sky-400";
const KO_BG = "bg-sky-500/10";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className={`text-xs font-semibold uppercase tracking-wider ${KO} mb-2`}>{children}</p>;
}

function NoteBox({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mt-3 rounded-md ${KO_BG} border border-sky-300/30 dark:border-sky-700/40 px-3 py-2 text-xs text-muted-foreground`}>
      {children}
    </div>
  );
}

interface FamilyMember {
  form: string;
  romanization: string;
  type: string;
  meaning: string;
  example?: string;
}

function WordFamilyCard({ root, rootRom, meaning, members }: { root: string; rootRom: string; meaning: string; members: FamilyMember[] }) {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-baseline gap-3 mb-4">
          <span className={`text-2xl font-bold ${KO}`}>{root}</span>
          <span className="text-base text-muted-foreground italic">{rootRom}</span>
          <span className="text-sm text-muted-foreground">— {meaning}</span>
        </div>
        <div className="rounded-md border border-border overflow-hidden text-sm">
          <div className="grid grid-cols-4 bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <span>Form</span><span>Type</span><span>Meaning</span><span>Example</span>
          </div>
          {members.map((m, i) => (
            <div key={m.form} className={`grid grid-cols-4 px-3 py-2 gap-1 ${i > 0 ? 'border-t border-border/50' : ''}`}>
              <div>
                <span className={`font-bold ${KO}`}>{m.form}</span>
                <span className="text-xs text-muted-foreground italic block">{m.romanization}</span>
              </div>
              <span className="text-muted-foreground text-xs self-center">{m.type}</span>
              <span className="self-center">{m.meaning}</span>
              <span className="text-muted-foreground text-xs self-center">{m.example ?? ''}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── 하다 family ───────────────────────────────────────────────────────────────

export function KoHADAFamilyCard() {
  return (
    <WordFamilyCard
      root="하다" rootRom="hada" meaning="to do / to be (adjective use)"
      members={[
        { form: '해요', romanization: 'haeyo', type: 'verb (polite)', meaning: 'do / does', example: '공부해요. Study.' },
        { form: '했어요', romanization: 'haesseoyo', type: 'verb (past)', meaning: 'did', example: '뭐 했어요? What did you do?' },
        { form: '할게요', romanization: 'halgeyo', type: 'verb (intention)', meaning: 'will do', example: '제가 할게요. I\'ll do it.' },
        { form: '하지 않아요', romanization: 'haji anayo', type: 'negative', meaning: 'don\'t do', example: '청소 안 해요. Don\'t clean.' },
        { form: '하고 싶어요', romanization: 'hago sipeoyo', type: 'desiderative', meaning: 'want to do', example: '뭐 하고 싶어요? What do you want to do?' },
        { form: '해야 해요', romanization: 'haeya haeyo', type: 'obligation', meaning: 'must do / have to do', example: '숙제 해야 해요. Must do homework.' },
        { form: '일하다', romanization: 'ilhada', type: 'compound verb', meaning: 'to work', example: '어디서 일해요? Where do you work?' },
        { form: '공부하다', romanization: 'gongbuhada', type: 'compound verb', meaning: 'to study', example: '한국어 공부해요. Study Korean.' },
        { form: '운동하다', romanization: 'undong-hada', type: 'compound verb', meaning: 'to exercise', example: '매일 운동해요. Exercise every day.' },
        { form: '전화하다', romanization: 'jeonhwahada', type: 'compound verb', meaning: 'to phone / call', example: '내일 전화할게요. Will call tomorrow.' },
      ]}
    />
  );
}

// ── 가다 family ───────────────────────────────────────────────────────────────

export function KoGADAFamilyCard() {
  return (
    <WordFamilyCard
      root="가다" rootRom="gada" meaning="to go"
      members={[
        { form: '가요', romanization: 'gayo', type: 'polite present', meaning: 'go / goes', example: '학교에 가요. Go to school.' },
        { form: '갔어요', romanization: 'gasseoyo', type: 'past', meaning: 'went', example: '어제 어디 갔어요? Where did you go?' },
        { form: '갈게요', romanization: 'galgeyo', type: 'intention', meaning: 'will go', example: '먼저 갈게요. I\'ll go first.' },
        { form: '가고 싶어요', romanization: 'gago sipeoyo', type: 'desiderative', meaning: 'want to go', example: '한국에 가고 싶어요. Want to go to Korea.' },
        { form: '갈 수 있어요', romanization: 'gal su isseoyo', type: 'potential', meaning: 'can go', example: '지금 갈 수 있어요? Can you go now?' },
        { form: '가면', romanization: 'gamyeon', type: 'conditional', meaning: 'if / when go', example: '서울에 가면 연락해요. If you go to Seoul, contact me.' },
        { form: '돌아가다', romanization: 'doraogada', type: 'compound', meaning: 'to return / go back', example: '집에 돌아갔어요. Went back home.' },
        { form: '올라가다', romanization: 'ollagada', type: 'compound', meaning: 'to go up', example: '산에 올라가요. Go up the mountain.' },
        { form: '내려가다', romanization: 'naeryeogada', type: 'compound', meaning: 'to go down', example: '지하에 내려가요. Go down underground.' },
        { form: '지나가다', romanization: 'jinagada', type: 'compound', meaning: 'to pass by / go past', example: '버스가 지나갔어요. The bus passed by.' },
      ]}
    />
  );
}

// ── 오다 family ───────────────────────────────────────────────────────────────

export function KoODAFamilyCard() {
  return (
    <WordFamilyCard
      root="오다" rootRom="oda" meaning="to come"
      members={[
        { form: '와요', romanization: 'wayo', type: 'polite present', meaning: 'come / comes', example: '언제 와요? When are you coming?' },
        { form: '왔어요', romanization: 'wasseoyo', type: 'past', meaning: 'came', example: '드디어 왔어요! You finally came!' },
        { form: '올게요', romanization: 'olgeyo', type: 'intention', meaning: 'will come', example: '지금 갈게요. (I\'m) coming now.' },
        { form: '오고 있어요', romanization: 'ogo isseoyo', type: 'progressive', meaning: 'coming (right now)', example: '지금 오고 있어요. Coming right now.' },
        { form: '나오다', romanization: 'naoda', type: 'compound', meaning: 'to come out', example: '밖으로 나와요. Come outside.' },
        { form: '들어오다', romanization: 'deureooda', type: 'compound', meaning: 'to come in / enter', example: '들어오세요. Please come in.' },
        { form: '올라오다', romanization: 'ollaoda', type: 'compound', meaning: 'to come up', example: '2층으로 올라오세요. Come up to 2F.' },
        { form: '돌아오다', romanization: 'doraoda', type: 'compound', meaning: 'to come back / return', example: '집에 돌아왔어요. Came back home.' },
        { form: '비가 오다', romanization: 'biga oda', type: 'idiomatic', meaning: 'it rains (lit: rain comes)', example: '비가 와요. It\'s raining.' },
        { form: '눈이 오다', romanization: 'nuni oda', type: 'idiomatic', meaning: 'it snows (lit: snow comes)', example: '눈이 와요. It\'s snowing.' },
      ]}
    />
  );
}

// ── 먹다 family ───────────────────────────────────────────────────────────────

export function KoMEOKDAFamilyCard() {
  return (
    <WordFamilyCard
      root="먹다" rootRom="meokda" meaning="to eat"
      members={[
        { form: '먹어요', romanization: 'meogeoyo', type: 'polite present', meaning: 'eat / eats', example: '뭐 먹어요? What are you eating?' },
        { form: '먹었어요', romanization: 'meogeosseoyo', type: 'past', meaning: 'ate', example: '점심 먹었어요? Did you eat lunch?' },
        { form: '먹을게요', romanization: 'meogeulgeyo', type: 'intention', meaning: 'will eat', example: '다 먹을게요. I\'ll eat it all.' },
        { form: '먹고 싶어요', romanization: 'meokgo sipeoyo', type: 'desiderative', meaning: 'want to eat', example: '김치찌개 먹고 싶어요. Want to eat kimchi jjigae.' },
        { form: '먹고 있어요', romanization: 'meokgo isseoyo', type: 'progressive', meaning: 'is eating', example: '지금 먹고 있어요. Currently eating.' },
        { form: '드시다', romanization: 'deusida', type: 'honorific', meaning: 'to eat (polite)', example: '많이 드세요. Please eat a lot.' },
        { form: '먹을 수 있어요', romanization: 'meogeul su isseoyo', type: 'potential', meaning: 'can eat', example: '매운 것 먹을 수 있어요? Can you eat spicy food?' },
        { form: 'ᄒ안 먹어요', romanization: 'an meogeoyo', type: 'negative', meaning: 'don\'t eat', example: '고기 안 먹어요. I don\'t eat meat.' },
        { form: '먹방 (먹+방송)', romanization: 'meokbang', type: 'compound noun', meaning: 'mukbang / eating broadcast', example: '먹방 봐요. I watch mukbang.' },
        { form: '과식하다', romanization: 'gwasikada', type: 'related verb', meaning: 'to overeat', example: '과식했어요. I overate.' },
      ]}
    />
  );
}

// ── 보다 family ───────────────────────────────────────────────────────────────

export function KoBODAFamilyCard() {
  return (
    <WordFamilyCard
      root="보다" rootRom="boda" meaning="to see / watch / look"
      members={[
        { form: '봐요', romanization: 'bwayo', type: 'polite present', meaning: 'see / watch', example: '영화 봐요. Watch a movie.' },
        { form: '봤어요', romanization: 'bwasseoyo', type: 'past', meaning: 'saw / watched', example: '그 드라마 봤어요? Did you watch that drama?' },
        { form: '보고 싶어요', romanization: 'bogo sipeoyo', type: 'desiderative', meaning: 'want to see / miss', example: '보고 싶어요. I miss you.' },
        { form: '보여요', romanization: 'boyeoyo', type: 'passive/appearance', meaning: 'is visible / looks like', example: '피곤해 보여요. You look tired.' },
        { form: '보여주다', romanization: 'boyeojuda', type: 'compound', meaning: 'to show', example: '사진 보여주세요. Please show me the photo.' },
        { form: '처다보다', romanization: 'cheodaboda', type: 'compound', meaning: 'to stare at', example: '왜 쳐다봐요? Why are you staring?' },
        { form: '바라보다', romanization: 'baraboda', type: 'compound', meaning: 'to gaze at / look towards', example: '바다를 바라봐요. Gaze at the sea.' },
        { form: '돌아보다', romanization: 'doraboda', type: 'compound', meaning: 'to look back / review', example: '지난 일을 돌아봐요. Look back on the past.' },
        { form: '보다 (comparative)', romanization: 'boda', type: 'particle (comparative)', meaning: 'than / compared to', example: '나보다 커요. Taller than me.' },
        { form: '볼게요', romanization: 'bolgeyo', type: 'intention', meaning: 'will look / will see', example: '한번 볼게요. I\'ll take a look.' },
      ]}
    />
  );
}

// ── 알다 family ───────────────────────────────────────────────────────────────

export function KoALDAFamilyCard() {
  return (
    <WordFamilyCard
      root="알다" rootRom="alda" meaning="to know"
      members={[
        { form: '알아요', romanization: 'arayo', type: 'polite present', meaning: 'know', example: '알아요. I know.' },
        { form: '알았어요', romanization: 'arasseoyo', type: 'past / acknowledgement', meaning: 'knew / understood / OK', example: '알았어요. Got it. / OK.' },
        { form: '몰라요', romanization: 'mollayo', type: 'negative (irregular)', meaning: 'don\'t know', example: '몰라요. I don\'t know.' },
        { form: '알 수 있어요', romanization: 'al su isseoyo', type: 'potential', meaning: 'can know / can tell', example: '어떻게 알 수 있어요? How can you know?' },
        { form: '알려주다', romanization: 'allyeojuda', type: 'compound', meaning: 'to let know / inform', example: '알려주세요. Please let me know.' },
        { form: '알아보다', romanization: 'araboda', type: 'compound', meaning: 'to find out / look into', example: '알아볼게요. I\'ll look into it.' },
        { form: '알아듣다', romanization: 'aradeudda', type: 'compound', meaning: 'to understand (by hearing)', example: '잘 알아들었어요. I understood well.' },
        { form: '알아내다', romanization: 'aranaeda', type: 'compound', meaning: 'to figure out / find out', example: '진실을 알아냈어요. Found out the truth.' },
        { form: '지식 (知識)', romanization: 'jisik', type: 'noun (Sino-Korean)', meaning: 'knowledge', example: '지식이 많아요. He has a lot of knowledge.' },
        { form: '이해하다', romanization: 'ihaehada', type: 'related verb', meaning: 'to understand', example: '이해해요. I understand.' },
      ]}
    />
  );
}

// ── 만들다 family ──────────────────────────────────────────────────────────────

export function KoMANDEULDAFamilyCard() {
  return (
    <WordFamilyCard
      root="만들다" rootRom="mandeulda" meaning="to make / create"
      members={[
        { form: '만들어요', romanization: 'mandeuleoyo', type: 'polite present', meaning: 'make / makes', example: '음식을 만들어요. Make food.' },
        { form: '만들었어요', romanization: 'mandeureo-sseoyo', type: 'past', meaning: 'made', example: '케이크 만들었어요. Made a cake.' },
        { form: '만들고 싶어요', romanization: 'mandeulgo sipeoyo', type: 'desiderative', meaning: 'want to make', example: '로봇 만들고 싶어요. Want to make a robot.' },
        { form: '만드는 중이에요', romanization: 'mandeuneun jungieyo', type: 'progressive', meaning: 'in the process of making', example: '지금 만드는 중이에요. Currently making it.' },
        { form: '만들어 주세요', romanization: 'mandeuleoyo juse-yo', type: 'request', meaning: 'please make (for me)', example: '커피 만들어 주세요. Please make coffee.' },
        { form: '만들어지다', romanization: 'mandeureojida', type: 'passive', meaning: 'to be made / formed', example: '어떻게 만들어졌어요? How was it made?' },
        { form: '제조하다', romanization: 'jejohada', type: 'formal verb', meaning: 'to manufacture', example: '한국에서 제조됩니다. Manufactured in Korea.' },
        { form: '창작하다', romanization: 'changjakhada', type: 'related verb', meaning: 'to create (artistic)', example: '음악을 창작해요. Create music.' },
        { form: '개발하다', romanization: 'gaebal-hada', type: 'related verb', meaning: 'to develop / build (apps/products)', example: '앱을 개발해요. Developing an app.' },
        { form: '만들어낸 것', romanization: 'mandeuleonae-n geot', type: 'noun phrase', meaning: 'something created / a creation', example: '훌륭한 만들어낸 것이에요. A wonderful creation.' },
      ]}
    />
  );
}

// ── 살다 family ───────────────────────────────────────────────────────────────

export function KoSALDAFamilyCard() {
  return (
    <WordFamilyCard
      root="살다" rootRom="salda" meaning="to live / to reside"
      members={[
        { form: '살아요', romanization: 'sarayo', type: 'polite present', meaning: 'live / reside', example: '서울에 살아요. I live in Seoul.' },
        { form: '살았어요', romanization: 'sarasseoyo', type: 'past', meaning: 'lived / used to live', example: '예전에 부산에 살았어요. I used to live in Busan.' },
        { form: '살고 싶어요', romanization: 'salgo sipeoyo', type: 'desiderative', meaning: 'want to live', example: '한국에서 살고 싶어요. Want to live in Korea.' },
        { form: '살고 있어요', romanization: 'salgo isseoyo', type: 'progressive', meaning: 'currently living', example: '부산에서 살고 있어요. Currently living in Busan.' },
        { form: '살아남다', romanization: 'saranamda', type: 'compound', meaning: 'to survive', example: '어떻게 살아남았어요? How did you survive?' },
        { form: '생활하다', romanization: 'saenghwal-hada', type: 'related verb', meaning: 'to lead a life / live daily', example: '한국에서 생활해요. Live/get by in Korea.' },
        { form: '생존하다', romanization: 'saengjonhada', type: 'formal/related', meaning: 'to exist / survive', example: '생존자가 있어요. There are survivors.' },
        { form: '삶', romanization: 'sam', type: 'noun', meaning: 'life (lived experience)', example: '행복한 삶이에요. It\'s a happy life.' },
        { form: '살림하다', romanization: 'salrimhada', type: 'compound', meaning: 'to manage a household', example: '집에서 살림해요. Manage the household.' },
        { form: '집에서 살다', romanization: 'jibeseo salda', type: 'phrase', meaning: 'to live at home', example: '아직 부모님 집에 살아요. Still live at parents\' home.' },
      ]}
    />
  );
}

// ── 좋다 family ───────────────────────────────────────────────────────────────

export function KoJOHDAFamilyCard() {
  return (
    <WordFamilyCard
      root="좋다" rootRom="johda" meaning="to be good / to like"
      members={[
        { form: '좋아요', romanization: 'joayo', type: 'adj. (polite)', meaning: 'is good / it\'s good', example: '날씨가 좋아요. The weather is nice.' },
        { form: '좋아요 (like)', romanization: 'joayo', type: 'verb (like)', meaning: 'like', example: '한국어 좋아요. I like Korean.' },
        { form: '좋았어요', romanization: 'joasseoyo', type: 'past', meaning: 'was good', example: '여행이 좋았어요. The trip was great.' },
        { form: '좋아하다', romanization: 'joahada', type: 'verb (habitual like)', meaning: 'to like (habitually)', example: '음악을 좋아해요. I like music.' },
        { form: '좋아지다', romanization: 'joajida', type: 'inchoative', meaning: 'to get better / improve', example: '날씨가 좋아졌어요. The weather got better.' },
        { form: '더 좋아요', romanization: 'deo joayo', type: 'comparative', meaning: 'is better', example: '이게 더 좋아요. This one is better.' },
        { form: '제일 좋아요', romanization: 'jeil joayo', type: 'superlative', meaning: 'is the best', example: '어떤 게 제일 좋아요? Which one is the best?' },
        { form: '마음에 들다', romanization: 'maeume deulda', type: 'idiomatic', meaning: 'to like / to one\'s taste', example: '이 옷 마음에 들어요. I like these clothes.' },
        { form: '좋은', romanization: 'joeun', type: 'modifier (adj.)', meaning: 'good (before noun)', example: '좋은 날씨예요. It\'s nice weather.' },
        { form: '최고예요', romanization: 'choegoye-yo', type: 'related phrase', meaning: 'is the best / top', example: '한국 음식 최고예요! Korean food is the best!' },
      ]}
    />
  );
}

// ── 말하다 family ─────────────────────────────────────────────────────────────

export function KoMALHADAFamilyCard() {
  return (
    <WordFamilyCard
      root="말하다" rootRom="malhada" meaning="to speak / say / tell"
      members={[
        { form: '말해요', romanization: 'malhaeyo', type: 'polite present', meaning: 'speak / say', example: '영어로 말해요. Speak in English.' },
        { form: '말했어요', romanization: 'malhaesseoyo', type: 'past', meaning: 'said / told', example: '뭐라고 말했어요? What did you say?' },
        { form: '말씀하시다', romanization: 'malsseumsida', type: 'honorific', meaning: 'to say (respectful)', example: '선생님이 말씀하셨어요. The teacher said.' },
        { form: '이야기하다', romanization: 'iyagihada', type: 'related verb', meaning: 'to talk / chat / tell a story', example: '이야기해요. Let\'s talk.' },
        { form: '얘기하다', romanization: 'yaegihada', type: 'colloquial', meaning: 'to chat (casual)', example: '잠깐 얘기해요. Let\'s chat for a bit.' },
        { form: '말을 걸다', romanization: 'mareul geolda', type: 'compound', meaning: 'to initiate a conversation', example: '낯선 사람에게 말을 걸었어요. Talked to a stranger.' },
        { form: '말이 없다', romanization: 'mari eopda', type: 'idiomatic', meaning: 'to be quiet / speechless', example: '그 사람은 말이 없어요. That person is quiet.' },
        { form: '말투', romanization: 'maltu', type: 'noun', meaning: 'way of speaking / tone', example: '말투가 좋아요. You have a nice way of speaking.' },
        { form: '대화하다', romanization: 'daehwahada', type: 'formal', meaning: 'to have a dialogue / converse', example: '대화가 필요해요. We need to talk.' },
        { form: '한국말', romanization: 'Hangungmal', type: 'noun', meaning: 'Korean language (colloquial)', example: '한국말 잘해요! Your Korean is great!' },
      ]}
    />
  );
}

// ── Resolver ───────────────────────────────────────────────────────────────────

export function resolveKoFamilyCard(chapterTitle: string) {
  const lower = chapterTitle.toLowerCase();
  if (lower.includes('하다') || lower.includes('hada')) return <KoHADAFamilyCard />;
  if (lower.includes('가다') || lower.includes('gada') || lower.includes('go')) return <KoGADAFamilyCard />;
  if (lower.includes('오다') || lower.includes('oda') || lower.includes('come')) return <KoODAFamilyCard />;
  if (lower.includes('먹다') || lower.includes('meok') || lower.includes('eat')) return <KoMEOKDAFamilyCard />;
  if (lower.includes('보다') || lower.includes('boda') || lower.includes('see') || lower.includes('watch')) return <KoBODAFamilyCard />;
  if (lower.includes('알다') || lower.includes('alda') || lower.includes('know')) return <KoALDAFamilyCard />;
  if (lower.includes('만들다') || lower.includes('mandeul') || lower.includes('make')) return <KoMANDEULDAFamilyCard />;
  if (lower.includes('살다') || lower.includes('salda') || lower.includes('live')) return <KoSALDAFamilyCard />;
  if (lower.includes('좋다') || lower.includes('johda') || lower.includes('good') || lower.includes('like')) return <KoJOHDAFamilyCard />;
  if (lower.includes('말하다') || lower.includes('malhada') || lower.includes('speak') || lower.includes('말')) return <KoMALHADAFamilyCard />;
  return <KoHADAFamilyCard />;
}
