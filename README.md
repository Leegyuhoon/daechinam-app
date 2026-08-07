# 대신치워주는남자 — 근태관리 앱 (PWA)

로고 아이콘까지 적용된, 실제 배포 가능한 프로젝트입니다.
홈 화면에 추가하면 **DAECHINAM 로고 아이콘**으로 앱처럼 실행됩니다.

## 폴더 구성
```
daechinam-app/
├─ public/
│  ├─ manifest.json        ← 앱 이름/아이콘 설정
│  └─ icons/                ← 로고에서 생성한 아이콘 세트
├─ src/
│  ├─ App.jsx                ← 근태관리 앱 본체 (기존 코드)
│  ├─ main.jsx
│  └─ index.css
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
└─ postcss.config.js
```

## 1. 로컬에서 먼저 확인 (선택)
컴퓨터에 Node.js가 설치되어 있다면:
```bash
npm install
npm run dev
```
브라우저에서 `http://localhost:5173` 접속해서 정상 작동하는지 확인하세요.

## 2. 배포 — Vercel (추천, 무료)
1. [vercel.com](https://vercel.com) 가입 (GitHub 계정으로 가입 가능)
2. 이 `daechinam-app` 폴더를 GitHub 저장소에 업로드
3. Vercel에서 "Add New Project" → 방금 만든 저장소 선택
4. Framework Preset: **Vite** 자동 인식됨 → "Deploy" 클릭
5. 몇 분 후 `https://xxxx.vercel.app` 같은 주소가 생성됨

## 2-B. 배포 — Netlify (더 간단, GitHub 없이도 가능)
1. 로컬에서 `npm install && npm run build` 실행 → `dist` 폴더 생성됨
2. [app.netlify.com/drop](https://app.netlify.com/drop) 접속
3. `dist` 폴더를 그대로 드래그 앤 드롭
4. 즉시 배포 주소 생성됨

## 3. 근무자에게 배포하기
1. 배포된 주소를 문자/카카오톡으로 근무자들에게 전달
2. 안드로이드: 크롬에서 링크 접속 → 메뉴(⋮) → "홈 화면에 추가"
3. 아이폰: 사파리에서 링크 접속 → 공유 버튼(□↑) → "홈 화면에 추가"
4. 홈 화면에 **DAECHINAM 로고 아이콘**이 생기고, 누르면 앱처럼 전체화면으로 실행됩니다.

## 4. 관리자 사용법
- 앱 내 관리자 메뉴는 PIN(숫자 4자리)으로 잠겨 있습니다.
- 최초 접속 시 설정 메뉴에서 PIN을 등록하세요.
- 모든 근무자의 출퇴근 기록은 공유 저장소에 쌓이므로, 관리자는 어느 기기에서 접속하든 전체 기록을 확인할 수 있습니다.

## 참고
- 아이콘은 `자산_8.png`(로고 마크)를 기반으로 192/512/180/32/16px 사이즈로 자동 생성했습니다.
- 회사명 기본값은 "대신치워주는남자"로 미리 설정해 두었습니다. 설정 메뉴에서 변경 가능합니다.
- 도메인을 직접 연결하고 싶다면(예: attend.daechinam.com), Vercel/Netlify의 "Domains" 설정에서 추가하면 됩니다.
