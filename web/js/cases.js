/* 사건 목록. 각 사건은 cases/<id>/data.js(규칙) + content.js(콘텐츠)로 이루어진다. */
window.CASE_LIST = [
  { id: 'four', save: 'four-degrees', thumb: 'img/case-four.jpg', title: '4°C', tag: '연락이 끊긴 대학원생 동생. 휴대폰은 한강으로, 동생은…?', minutes: '40~60분', level: '보통', where: '대학 연구동 3개 층' },
  { id: 'room', save: 'mochi', thumb: 'img/case-room.jpg', title: '모찌는 어디에', tag: '출장에서 돌아오니, 고양이가 사라졌다.', minutes: '10~15분', level: '쉬움', where: '자취방과 복도' },
];
window.CASE_ID = (() => {
  const q = new URLSearchParams(location.search).get('case');
  const id = q || localStorage.getItem('case-current') || 'four';
  return window.CASE_LIST.some(c => c.id === id) ? id : 'four';
})();
localStorage.setItem('case-current', window.CASE_ID);
