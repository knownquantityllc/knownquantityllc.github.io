/* Sloth Band vs. Platypus translations: English -> [Spanish, Simplified Chinese, Russian]. The sloths keep their names. */
(function () {
  var LV = [
    ["Opening Act", "Telonero", "暖场演出", "На разогреве"],
    ["Two-Step", "Dos pasos", "两步舞", "Два шага"],
    ["Stack It Up", "Bien apilado", "层层叠叠", "Строим башню"],
    ["Cold Open", "Arranque en frío", "冷开场", "С места в карьер"],
    ["High Note", "Nota alta", "高音", "Высокая нота"],
    ["Rock Solid", "Roca firme", "坚如磐石", "Крепкий орешек"],
    ["Pyramid Scheme", "Pirámide", "金字塔", "Пирамида"],
    ["Mixed Media", "Técnica mixta", "混搭", "Всё вперемешку"],
    ["The Fortress", "La fortaleza", "堡垒", "Крепость"],
    ["Floating Stage", "Escenario flotante", "空中舞台", "Парящая сцена"],
    ["Glass House", "Casa de cristal", "玻璃房", "Стеклянный дом"],
    ["Headliner", "Cabeza de cartel", "压轴大戏", "Хедлайнер"]
  ];
  var rows = {};
  LV.forEach(function (r) {
    rows[r[0]] = [r[1], r[2], r[3]];
    // HUD "3. Stack It Up" and the level button "Level 3: Stack It Up"
    rows['{0}. ' + r[0]] = ['{0}. ' + r[1], '{0}. ' + r[2], '{0}. ' + r[3]];
    rows['Level {0}: ' + r[0]] = ['Nivel {0}: ' + r[1], '第 {0} 关：' + r[2], 'Уровень {0}: ' + r[3]];
  });
  KQI18n.addRows(rows);
})();
KQI18n.addRows({
  "Sloth Band vs. Platypus play field": ["Campo de juego de Sloth Band vs. Platypus", "Sloth Band vs. Platypus 游戏场地", "Игровое поле Sloth Band vs. Platypus"],
  "Restart level": ["Reiniciar nivel", "重新开始本关", "Начать уровень заново"],
  "Pause": ["Pausa", "暂停", "Пауза"],
  "The platypuses stole the stage. Launch the band and take it back!": ["Los ornitorrincos se adueñaron del escenario. ¡Lanza a la banda y recupéralo!", "鸭嘴兽抢走了舞台。把乐队弹出去，夺回舞台！", "Утконосы захватили сцену. Запускай группу и верни её!"],
  "Play": ["Jugar", "开始", "Играть"],
  "coins": ["monedas", "金币", "монеты"],
  "Set List": ["Repertorio", "曲目单", "Сет-лист"],
  "Back": ["Atrás", "返回", "Назад"],
  "Paused": ["En pausa", "已暂停", "Пауза"],
  "Resume": ["Seguir", "继续", "Продолжить"],
  "Restart": ["Reiniciar", "重来", "Заново"],
  "Retry": ["Reintentar", "再试一次", "Ещё раз"],
  "Next": ["Siguiente", "下一关", "Дальше"],
  "Turn your phone sideways for the best show.": ["Gira el teléfono de lado para ver mejor el concierto.", "把手机横过来，演出效果最好。", "Поверни телефон боком, так шоу смотрится лучше."],
  "Play anyway": ["Jugar igual", "仍然开始", "Всё равно играть"],
  "Sound: off": ["Sonido: no", "声音：关", "Звук: выкл."],
  "Sound: on": ["Sonido: sí", "声音：开", "Звук: вкл."],
  "Drums": ["Batería", "鼓", "Барабаны"],
  "Trumpet": ["Trompeta", "小号", "Труба"],
  "Guitar": ["Guitarra", "吉他", "Гитара"],
  "Tuba": ["Tuba", "大号", "Туба"],
  "{0} on drums": ["{0} a la batería", "{0} 打鼓", "{0} на барабанах"],
  "{0} on trumpet": ["{0} a la trompeta", "{0} 吹小号", "{0} на трубе"],
  "{0} on guitar": ["{0} a la guitarra", "{0} 弹吉他", "{0} на гитаре"],
  "{0} on tuba": ["{0} a la tuba", "{0} 吹大号", "{0} на тубе"],
  "Tap mid-air: BOOM! A drum blast knocks everything nearby flying.": ["Toca en el aire: ¡BUM! Un golpe de tambor lanza por los aires todo lo que está cerca.", "空中点击：咚！鼓声冲击波把附近的东西全掀飞。", "Нажми в полёте: БУМ! Удар барабана разбрасывает всё вокруг."],
  "Tap mid-air: a fanfare blasts Toot forward at top speed.": ["Toca en el aire: una fanfarria lanza a Toot hacia delante a toda velocidad.", "空中点击：一阵号角把 Toot 全速向前推出。", "Нажми в полёте: фанфары несут Toot вперёд на полной скорости."],
  "Tap mid-air: strum a chord and split into three sloths.": ["Toca en el aire: rasguea un acorde y divídete en tres perezosos.", "空中点击：扫一个和弦，分成三只树懒。", "Нажми в полёте: сыграй аккорд и разделись на трёх ленивцев."],
  "Heavy hitter. Tap mid-air to slam straight down.": ["Pega fuerte. Toca en el aire para caer en picado.", "重量级选手。空中点击直接砸下去。", "Тяжеловес. Нажми в полёте, чтобы рухнуть вниз."],
  "Pull back and let go.": ["Tira hacia atrás y suelta.", "向后拉，然后松手。", "Натяни и отпусти."],
  "Drag the sloth away from the slingshot, aim with the dotted arc, and pop every platypus.": ["Arrastra al perezoso lejos de la resortera, apunta con el arco punteado y revienta a todos los ornitorrincos.", "把树懒从弹弓上往后拖，用虚线弧瞄准，打爆每一只鸭嘴兽。", "Оттяни ленивца от рогатки, целься по пунктирной дуге и сбей всех утконосов."],
  "Encore!": ["¡Otra, otra!", "安可！", "Бис!"],
  "The platypuses heckled you": ["Los ornitorrincos te abuchearon", "鸭嘴兽把你嘘下台了", "Утконосы тебя освистали"],
  "1 sloth left: +{0}": ["Queda 1 perezoso: +{0}", "剩余 1 只树懒：+{0}", "Остался 1 ленивец: +{0}"],
  "{0} sloths left: +{1}": ["Quedan {0} perezosos: +{1}", "剩余 {0} 只树懒：+{1}", "Бонус за ленивцев ({0}): +{1}"],
  "New best!": ["¡Nuevo récord!", "新纪录！", "Новый рекорд!"],
  "Try a different angle, or save the special move for the right moment.": ["Prueba otro ángulo o guarda el movimiento especial para el momento justo.", "换个角度试试，或者把特技留到关键时刻。", "Попробуй другой угол или прибереги особый приём для нужного момента."],
  "{0} • {1}": ["{0} • {1}", "{0} • {1}", "{0} • {1}"],
  "+{0} coins": ["+{0} monedas", "+{0} 金币", "Монеты: +{0}"],
  "Language": ["Idioma", "语言", "Язык"]
});
