import { AudienceReview } from '../types/horror';
import { CURATED_CATALOG } from './catalog';

const REVIEWS_BY_TITLE: Record<string, AudienceReview[]> = {
  遗传厄运: [
    {
      id: 'rev-her-1',
      author: '林深',
      stars: 5,
      date: '2026-11-02',
      content: '家庭悲剧的窒息感比超自然设定更先一步击垮观众，托妮·科莱特在餐桌爆发的那场戏堪称教科书级别。',
    },
    {
      id: 'rev-her-2',
      author: 'KurosawaFan',
      stars: 5,
      date: '2026-10-14',
      content: '伏笔密度极高，微缩模型视角和音效低频设计营造出一种宿命早已写就的无力感，后劲极强。',
    },
    {
      id: 'rev-her-3',
      author: '夜航船',
      stars: 4,
      date: '2026-09-21',
      content: '前半段心理写实极其扎实，后半段转向邪教仪式的节奏稍微有点突兀，但整体压迫感一流。',
    },
    {
      id: 'rev-her-4',
      author: 'Momo',
      stars: 3,
      date: '2026-08-30',
      content: '氛围确实阴冷，不过个人不太喜欢结尾突然直白化的超自然揭晓，前面留白更有味道。',
    },
    {
      id: 'rev-her-5',
      author: '老派影迷',
      stars: 2,
      date: '2026-07-12',
      content: '节奏太慢了，前一个小时几乎全是家庭吵架，期待传统吓人桥段的观众可能会觉得冗长。',
    },
  ],
  闪灵: [
    {
      id: 'rev-shi-1',
      author: '北极星放映室',
      stars: 5,
      date: '2026-10-31',
      content: '对称走廊、地毯几何纹路和低机位跟拍构筑出无可替代的空间幽闭感，百看不厌的影史巅峰。',
    },
    {
      id: 'rev-shi-2',
      author: 'Sora',
      stars: 5,
      date: '2026-09-18',
      content: '没有廉价的突脸惊吓，全靠声画错位和孤绝雪景把理智一点点磨碎，尼科尔森的表演极具震慑力。',
    },
    {
      id: 'rev-shi-3',
      author: '陈默',
      stars: 4,
      date: '2026-08-05',
      content: '摄影和配乐满分，但若以原著小说标准来看，男主角黑化来得偏早，缺少一层缓慢挣扎的弧光。',
    },
    {
      id: 'rev-shi-4',
      author: '阿树',
      stars: 3,
      date: '2026-06-11',
      content: '视听美学确实牛，不过两个半小时的慢节奏以现在的观影习惯看下来没有想象中那么吓人。',
    },
  ],
  午夜凶铃: [
    {
      id: 'rev-rin-1',
      author: '录像带收藏家',
      stars: 5,
      date: '2026-11-01',
      content: '把日常家用电器变成诅咒媒介的天才构想，湿冷阴郁的质感至今让日式心理恐怖难以逾越。',
    },
    {
      id: 'rev-rin-2',
      author: '雾岛',
      stars: 4,
      date: '2026-09-25',
      content: '调查线索层层剥开的悬疑感很强，哪怕早知道贞子出井的经典名场面，配合音效依然头皮发麻。',
    },
    {
      id: 'rev-rin-3',
      author: 'Vesper',
      stars: 3,
      date: '2026-07-19',
      content: '中段推理偏平缓，真正高能集中在最后二十分钟，时代滤镜很重但经典地位无可置疑。',
    },
    {
      id: 'rev-rin-4',
      author: 'Zero',
      stars: 2,
      date: '2026-05-03',
      content: '现在回头看画质和节奏都很古早，除了最后一个镜头几乎没有现代意义上的惊吓点。',
    },
  ],
  怪形: [
    {
      id: 'rev-thi-1',
      author: '极地哨兵',
      stars: 5,
      date: '2026-10-18',
      content: '物理特效至今吊打绝大多数CG怪物，全员互相猜忌的心理张力和绝望结尾冷峻到骨子里。',
    },
    {
      id: 'rev-thi-2',
      author: '罗素',
      stars: 5,
      date: '2026-08-29',
      content: '验血那场戏能写进悬疑调度教材，卡彭特和莫里康内联手把极寒孤立感拉到极致。',
    },
    {
      id: 'rev-thi-3',
      author: 'Lin',
      stars: 4,
      date: '2026-07-04',
      content: '生物畸变设计非常重口且富有想象力，唯一小遗憾是前半段人物脸盲需要适应一下。',
    },
    {
      id: 'rev-thi-4',
      author: '浅夏',
      stars: 2,
      date: '2026-04-20',
      content: '血肉糊成一团的生理不适远大于恐怖感，不太能接受粘腻器官变异的观众慎入。',
    },
  ],
  仲夏夜惊魂: [
    {
      id: 'rev-mid-1',
      author: '白夜行者',
      stars: 5,
      date: '2026-10-09',
      content: '敢在刺眼日光和缤纷花海里拍出极致的毛骨悚然，失恋情绪与异教洗脑的双重共鸣令人震撼。',
    },
    {
      id: 'rev-mid-2',
      author: 'Yuki',
      stars: 4,
      date: '2026-08-15',
      content: '构图、服装和民间配乐美得像一场清醒的噩梦，就是接近两个半小时的片长略显冗长。',
    },
    {
      id: 'rev-mid-3',
      author: '大卫',
      stars: 3,
      date: '2026-06-28',
      content: '美术很强但角色降智明显，明明疑点重重却一个个主动留下来送人头，削弱了真实感。',
    },
    {
      id: 'rev-mid-4',
      author: 'Echo',
      stars: 1,
      date: '2026-05-14',
      content: '既不吓人又拖沓，全程看一群人莫名其妙发癫，个人完全无法共情这种形式主义。',
    },
  ],
  某种物质: [
    {
      id: 'rev-sub-1',
      author: '胶片狂热者',
      stars: 5,
      date: '2026-10-22',
      content: '狂躁的近景声效和毫不妥协的肉体畸变，把容貌焦虑讽刺成一场酣畅淋漓的午夜疯癫大秀。',
    },
    {
      id: 'rev-sub-2',
      author: 'Nina',
      stars: 4,
      date: '2026-09-03',
      content: '黛米·摩尔在镜前卸妆那段比后面所有血浆更刺痛人，工业级声音设计加分极多。',
    },
    {
      id: 'rev-sub-3',
      author: '阿泽',
      stars: 3,
      date: '2026-07-27',
      content: '前半部分讽刺精准犀利，最后二十分钟彻底失控成纯B级片血浆喷射，观感两极分化。',
    },
    {
      id: 'rev-sub-4',
      author: '清茶',
      stars: 2,
      date: '2026-06-02',
      content: '生理不适感过于强烈，很多特写镜头纯属为了恶心而恶心，主题表达其实很简单重复。',
    },
  ],
  X圣治: [
    {
      id: 'rev-cur-1',
      author: '东京下雨了',
      stars: 5,
      date: '2026-11-10',
      content: '没有鬼怪却比鬼片冷一百倍，日常水流声、打火机声和固定长镜头直接把理智催眠掏空。',
    },
    {
      id: 'rev-cur-2',
      author: '灰烬',
      stars: 5,
      date: '2026-10-04',
      content: '黑泽清最神的一部，役所广司与萩原圣人的对手戏充满诡异的哲学张力，看完久久回不过神。',
    },
    {
      id: 'rev-cur-3',
      author: 'Soren',
      stars: 4,
      date: '2026-08-19',
      content: '极简到极致的心理悬疑恐怖，开放式结局那几个眼神越回想越寒毛直竖。',
    },
    {
      id: 'rev-cur-4',
      author: '小北',
      stars: 3,
      date: '2026-07-08',
      content: '文艺气质太浓、节奏偏闷，冲着传统惊吓去看可能会打瞌睡，适合深夜静下心细品。',
    },
    {
      id: 'rev-cur-5',
      author: 'Rex',
      stars: 2,
      date: '2026-05-22',
      content: '催眠设定过于玄乎且缺乏明确解释，很多动机留白过头，看完一头雾水。',
    },
  ],
  哭声: [
    {
      id: 'rev-wai-1',
      author: '山雨欲来',
      stars: 5,
      date: '2026-11-14',
      content: '萨满祭祀与暴雨泥泞交织出惊人的视听狂气，在“疑神疑鬼”的信仰拉扯里把观众骗到最后一秒。',
    },
    {
      id: 'rev-wai-2',
      author: 'Jae',
      stars: 5,
      date: '2026-10-01',
      content: '国村隼演得太瘆人了，最后山洞里拿起相机那一刻绝对是近十年亚洲恐怖片最寒彻心扉的瞬间。',
    },
    {
      id: 'rev-wai-3',
      author: '木棉',
      stars: 4,
      date: '2026-08-22',
      content: '信息量巨大且极具民族巫蛊质感，中段略微有点乱但结尾反转把一切全盘收束了。',
    },
    {
      id: 'rev-wai-4',
      author: '周舟',
      stars: 3,
      date: '2026-06-17',
      content: '两个半小时塞了太多宗教隐喻和反转，前面喜剧调门和后面惊悚转折衔接有点割裂。',
    },
    {
      id: 'rev-wai-5',
      author: '路人甲',
      stars: 2,
      date: '2026-04-30',
      content: '全片都在云里雾里地故弄玄虚，为了反转而制造信息不对称，看得很累。',
    },
  ],
  阴风阵阵: [
    {
      id: 'rev-sus-1',
      author: '哥布林合成器',
      stars: 5,
      date: '2026-10-28',
      content: '红蓝紫三原色高饱和滤镜加上哥布林乐队鬼魅的电子摇滚，把血腥谋杀拍成了迷幻艺术展。',
    },
    {
      id: 'rev-sus-2',
      author: 'Clara',
      stars: 4,
      date: '2026-09-12',
      content: '铅黄电影的巅峰美学样本，建筑几何与玻璃光影太惊艳，剧情逻辑反倒只是承载视听的骨架。',
    },
    {
      id: 'rev-sus-3',
      author: 'Leo',
      stars: 3,
      date: '2026-07-03',
      content: '色彩和音乐非常顶，但以现代眼光看剧情实在单薄，人物行为和打斗都有点滑稽。',
    },
    {
      id: 'rev-sus-4',
      author: '风间',
      stars: 2,
      date: '2026-05-19',
      content: '噪音配乐吵得脑仁疼，红红绿绿的打光看久了眼花，剧情基本为零。',
    },
  ],
  女巫: [
    {
      id: 'rev-wit-1',
      author: '黑山羊菲利普',
      stars: 5,
      date: '2026-11-05',
      content: '极度考究的17世纪古英语对白和自然烛光摄影，清教徒家庭自我瓦解的过程比女巫本身更可怕。',
    },
    {
      id: 'rev-wit-2',
      author: 'Iris',
      stars: 4,
      date: '2026-09-29',
      content: '荒野边缘的孤独感和宗教偏执刻画得入木三分，安雅的眼神戏灵气十足。',
    },
    {
      id: 'rev-wit-3',
      author: 'Sam',
      stars: 3,
      date: '2026-07-15',
      content: '历史还原度很棒，但节奏太缓且台词晦涩，全片几乎没有让人心跳加速的高潮段落。',
    },
    {
      id: 'rev-wit-4',
      author: '阿强',
      stars: 2,
      date: '2026-06-09',
      content: '整部片灰蒙蒙的又闷又慢，看山羊和祈祷看了九十分钟，完全不吓人。',
    },
  ],
  异形: [
    {
      id: 'rev-ali-1',
      author: '诺斯特罗莫船员',
      stars: 5,
      date: '2026-10-24',
      content: '工业级太空船舱压抑感、吉格尔生物机械美学和完美的节奏控制，科幻恐怖永恒的圣经。',
    },
    {
      id: 'rev-ali-2',
      author: 'Ken',
      stars: 5,
      date: '2026-09-07',
      content: '前四十分钟慢热铺垫出惊人的真实工业质感，破胸那一幕即使知道剧情依然震撼。',
    },
    {
      id: 'rev-ali-3',
      author: 'Mina',
      stars: 4,
      date: '2026-07-22',
      content: '女英雄雷普利的塑造放到今天依然极其超前，阴暗通风管道里的窒息感太真实了。',
    },
    {
      id: 'rev-ali-4',
      author: 'FastWatch',
      stars: 3,
      date: '2026-05-11',
      content: '审美确实经典，不过和续集比起来动作戏很少，前段太空航行节奏偏慢。',
    },
  ],
  切肤之爱: [
    {
      id: 'rev-aud-1',
      author: 'KiriKiri',
      stars: 5,
      date: '2026-10-12',
      content: '前七十分钟拍成温柔日式文艺爱情片，最后二十分钟突然把人拽入地狱般的生理与心理炼狱，结构反差太狠了。',
    },
    {
      id: 'rev-aud-2',
      author: 'Taro',
      stars: 4,
      date: '2026-08-30',
      content: '椎名英姬的“奇里奇里”低语至今是恐怖片听觉噩梦，对男性凝视的解构也非常犀利。',
    },
    {
      id: 'rev-aud-3',
      author: '小鱼',
      stars: 3,
      date: '2026-06-25',
      content: '前面实在铺垫得太久了，最后酷刑部分虽然狠但梦境与现实交叉剪辑略显凌乱。',
    },
    {
      id: 'rev-aud-4',
      author: 'May',
      stars: 1,
      date: '2026-04-18',
      content: '纯属极端的折磨虐杀场面让人极度反胃，无法欣赏这种靠钢丝和针刺制造的不适感。',
    },
  ],
  逃出绝命镇: [
    {
      id: 'rev-get-1',
      author: 'SunkenPlace',
      stars: 5,
      date: '2026-11-08',
      content: '用恐怖类型片外壳精准刺穿中产虚伪善意，茶杯勺子声那段心理催眠戏紧张到不敢喘气。',
    },
    {
      id: 'rev-get-2',
      author: 'Alex',
      stars: 4,
      date: '2026-09-16',
      content: '伏笔收回得非常工整，每一句看似礼貌的寒暄二刷时都细思极恐。',
    },
    {
      id: 'rev-get-3',
      author: 'Evan',
      stars: 3,
      date: '2026-08-01',
      content: '社会讽刺巧思十足，但纯粹作为恐怖片来看吓人程度有限，更像黑色幽默惊悚片。',
    },
  ],
  回路: [
    {
      id: 'rev-pul-1',
      author: '灰白色拨号音',
      stars: 5,
      date: '2026-11-11',
      content: '那场走廊红胶带房间幽灵慢步走来的戏，是我看过的最诡异、最令人腿软的鬼片镜头，没有之一。',
    },
    {
      id: 'rev-pul-2',
      author: 'Haru',
      stars: 4,
      date: '2026-09-14',
      content: '把互联网时代的现代孤独感具象成鬼魂溢出，荒凉末世感拍得无比诗意又绝望。',
    },
    {
      id: 'rev-pul-3',
      author: 'Zack',
      stars: 3,
      date: '2026-07-20',
      content: '前半段吓死人，后半段世界末日格局拉得太大反而变得有些飘渺散乱。',
    },
    {
      id: 'rev-pul-4',
      author: '大雄',
      stars: 2,
      date: '2026-05-09',
      content: '情节支离破碎，很多人物突然就消失成灰了，看不懂导演想讲什么完整故事。',
    },
  ],
  驱魔人: [
    {
      id: 'rev-exo-1',
      author: '神父的灯',
      stars: 5,
      date: '2026-10-30',
      content: '写实记录片般的冷峻开场让恶魔附身显得格外真实，母女亲情与信仰动摇赋予了它厚重的悲剧感。',
    },
    {
      id: 'rev-exo-2',
      author: 'Rachel',
      stars: 4,
      date: '2026-08-19',
      content: '化妆特效和声效设计在七十年代简直是降维打击，卡拉斯神父的内心挣扎非常动人。',
    },
    {
      id: 'rev-exo-3',
      author: 'Kai',
      stars: 3,
      date: '2026-06-04',
      content: '宗教文化隔阂让附身桥段少了些代入感，倒着下楼梯那幕确实经典。',
    },
  ],
  惊变28天: [
    {
      id: 'rev-28d-1',
      author: '空城伦敦',
      stars: 5,
      date: '2026-10-15',
      content: '粗糙DV画质和疯狂奔跑的感染者彻底改写了现代丧尸片语法，开篇空无一人的伦敦桥震撼至今。',
    },
    {
      id: 'rev-28d-2',
      author: 'BoyleFan',
      stars: 4,
      date: '2026-08-09',
      content: '后半段军营对峙揭露人性比感染者更险恶，配乐响起时悲壮感拉满。',
    },
    {
      id: 'rev-28d-3',
      author: 'Luka',
      stars: 3,
      date: '2026-06-21',
      content: '低像素数字摄影放到大屏幕上太糊了，部分剪辑晃得头晕。',
    },
  ],
  它在身后: [
    {
      id: 'rev-itf-1',
      author: '匀速逼近',
      stars: 5,
      date: '2026-10-06',
      content: '永远以步行速度穿过人群朝你走来的规则太绝了，每次背景里出现陌生人走路都让人神经紧绷。',
    },
    {
      id: 'rev-itf-2',
      author: 'Sue',
      stars: 4,
      date: '2026-08-27',
      content: '怀旧合成器配乐和底特律衰败郊区构成了独特的青春梦魇质感，泳池那场略显儿戏但瑕不掩瑜。',
    },
    {
      id: 'rev-itf-3',
      author: 'Kevin',
      stars: 2,
      date: '2026-07-02',
      content: '设定挺新颖可惜越往后越垮，结尾用几个家用电器去电鬼简直搞笑。',
    },
  ],
  灵异咒: [
    {
      id: 'rev-nor-1',
      author: '伪纪录信徒',
      stars: 5,
      date: '2026-11-03',
      content: '把电视新闻、灵异节目和家庭录像混剪成一张严丝合缝的诅咒巨网，真实感强到看完不敢关灯。',
    },
    {
      id: 'rev-nor-2',
      author: 'Akira',
      stars: 4,
      date: '2026-09-20',
      content: '民俗仪式细节考据非常扎实，虽然锡箔纸疯子有点出戏，但整体沉浸感堪称伪纪录片天花板。',
    },
    {
      id: 'rev-nor-3',
      author: 'Toby',
      stars: 3,
      date: '2026-07-11',
      content: '近两个小时的伪纪录片稍微有点繁琐，前面铺垫线头太多容易走神。',
    },
  ],
  月光光心慌慌: [
    {
      id: 'rev-hal-1',
      author: 'Haddonfield',
      stars: 5,
      date: '2026-10-31',
      content: '几乎没流多少血却靠极简钢琴主题曲和宽银幕构图制造出纯粹的未知恐惧，Slasher鼻祖当之无愧。',
    },
    {
      id: 'rev-hal-2',
      author: 'Owen',
      stars: 4,
      date: '2026-09-02',
      content: '迈克尔·迈尔斯站在灌木丛后默默注视的几个广角镜头，压迫感远胜现代一惊一乍的血浆片。',
    },
    {
      id: 'rev-hal-3',
      author: '小李',
      stars: 2,
      date: '2026-06-14',
      content: '反派像打不死的木头人，几个青少年角色尖叫来尖叫去实在太老套了。',
    },
  ],
  回应我: [
    {
      id: 'rev-tal-1',
      author: '90秒倒计时',
      stars: 5,
      date: '2026-11-09',
      content: '把通灵拍成青少年社交成瘾的隐喻极具新意，几场附身瞬间的视听冲击力十足且毫无尿点。',
    },
    {
      id: 'rev-tal-2',
      author: 'Chloe',
      stars: 4,
      date: '2026-10-05',
      content: '节奏非常紧绷，丧母创伤线和鬼魂诱惑结合得挺自然，结局宿命感回味无穷。',
    },
    {
      id: 'rev-tal-3',
      author: 'Ben',
      stars: 3,
      date: '2026-08-18',
      content: '概念不错但人物还是太作死了，明明见识过后果还要作死超时，爽片有余深度一般。',
    },
  ],
};

export function getAudienceReviewsForMovie(movie: {
  title: string;
  original_title?: string;
}): AudienceReview[] {
  const key = movie.title.trim();
  if (REVIEWS_BY_TITLE[key]) {
    return REVIEWS_BY_TITLE[key];
  }
  if (movie.original_title) {
    const foundKey = Object.keys(REVIEWS_BY_TITLE).find(
      (k) => k.toLowerCase() === movie.original_title!.trim().toLowerCase()
    );
    if (foundKey) return REVIEWS_BY_TITLE[foundKey];
  }

  // Provide tailored audience reviews for built-in catalog films
  const catalogMatch = CURATED_CATALOG.find(
    (c) =>
      c.title.trim().toLowerCase() === key.toLowerCase() ||
      (movie.original_title &&
        c.original_title.trim().toLowerCase() ===
          movie.original_title.trim().toLowerCase())
  );

  if (!catalogMatch) {
    return [];
  }

  const genreLabel = catalogMatch.genres[0] || '恐怖片';
  const directorLabel = catalogMatch.director;

  return [
    {
      id: `rev-${catalogMatch.catalog_id}-1`,
      author: '深夜放映员',
      stars: 5,
      date: '2026-10-28',
      content: `《${catalogMatch.title}》把${genreLabel}的压迫氛围调度得极稳，${directorLabel}在声效留白与节奏控制上几乎没有废笔，后劲非常足。`,
    },
    {
      id: `rev-${catalogMatch.catalog_id}-2`,
      author: '胶片档案室',
      stars: 4,
      date: '2026-09-15',
      content: `${catalogMatch.release_year}年${catalogMatch.country}代表作之一，核心设定推进扎实，关键高能段落至今看依然让人脊背发凉。`,
    },
    {
      id: `rev-${catalogMatch.catalog_id}-3`,
      author: '阿泽看片',
      stars: 3,
      date: '2026-07-22',
      content: '视听气质和类型质感都很鲜明，不过中段节奏略偏慢热，适合深夜安静环境独自观看。',
    },
    {
      id: `rev-${catalogMatch.catalog_id}-4`,
      author: '夜猫子',
      stars: 2,
      date: '2026-05-19',
      content: '期待纯密集惊吓的观众可能会觉得铺垫稍长，整体更偏氛围与概念取胜。',
    },
  ];
}

export interface AudienceReviewSummary {
  totalCount: number;
  averageStars: number;
  positiveCount: number;
  distribution: {
    stars: 5 | 4 | 3 | 2 | 1;
    count: number;
    pct: number;
  }[];
}

export function computeAudienceSummary(
  reviews: AudienceReview[]
): AudienceReviewSummary | null {
  if (reviews.length === 0) return null;
  const totalCount = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + r.stars, 0);
  const averageStars = Number((sum / totalCount).toFixed(1));
  const positiveCount = reviews.filter((r) => r.stars >= 4).length;

  const tiers: (5 | 4 | 3 | 2 | 1)[] = [5, 4, 3, 2, 1];
  const distribution = tiers.map((stars) => {
    const count = reviews.filter((r) => r.stars === stars).length;
    return {
      stars,
      count,
      pct: Math.round((count / totalCount) * 100),
    };
  });

  return {
    totalCount,
    averageStars,
    positiveCount,
    distribution,
  };
}
