# Notebook Lab

[연구 사이트 열기](https://techkwon.github.io/gemini-notebook-flashcard-lab/)

같은 고양이 사진을 이미지·슬라이드·문서로 나누고, 프롬프트를 바꿔 검사한 독립 Gemini Notebook 사례 연구입니다. **3회·9세트·실제 92장**, 관찰일 2026-10-19.

## 공유 노트북

- [이미지만](https://notebook.google.com/notebook/e46e9c52-3172-4995-9355-9402f11c780c)
- [슬라이드만](https://notebook.google.com/notebook/8db1bd18-5d21-4fcd-8049-d0c0172593c2)
- [문서만](https://notebook.google.com/notebook/ec7b8817-feb5-479b-816e-bdbe9822cba4)

링크가 있는 사용자에게 보기 전용으로 공유하고 사본 생성 허용을 해제했습니다. Google 로그인이 필요할 수 있습니다. 미로그인·타 계정 열람 성공을 보장하지 않습니다.

## 디자인과 동작

- 실제 컴파일되는 WebGL 오로라, Canvas2D 입자·연결선·포인터 반응 및 2D 대체 배경
- 3D 앞뒤 카드, 포인터 틸트·조명·자석 버튼, 스크롤 등장·카운터·진행률, 회차별 전환
- 시스템 모션 최소화, 수동 정지와 선택 저장, 백그라운드 탭 정지, 모바일 입자·DPR 제한
- 원본 카드 증거 확대, 회차 탭 키보드 조작, 실제 프롬프트 복사, 텍스트 전용 수정 CSV
- 제목·설명·canonical·Open Graph·1200×630 공유 이미지·JSON-LD·sitemap·robots
- SVG·PNG·ICO 파비콘, Apple 홈 화면 아이콘·웹 앱 manifest, 404 페이지

Claude Code CLI **2.1.293 / `claude-opus-5-5`**가 모션 엔진과 기본 스타일을 작성했습니다. 실제 CLI 결과의 `modelUsage.canonicalModel`을 확인했습니다. 이후 Aside가 구조·데이터 연결, 3D 플립, SEO·접근성·실패 대체 동작을 통합하고 브라우저에서 검수했습니다. 연구에 쓰인 Notebook 생성 모델 버전·비용·소요시간은 측정하지 않았습니다.

## 검증과 유지보수

- `web/`: 의존성 없는 정적 배포 파일
- `web/data/research.json`: 공개 집계·방법·한계·사진 출처
- 로컬 미리보기: Node 20+에서 `node scripts/serve.mjs`
- 배포 전 검사: `node scripts/check-static.mjs`
- main push 시 문법·집계·자산·SEO 검사를 거쳐 GitHub Pages 배포

360·390·768·1440px와 시스템 모션 최소화 환경을 검사했습니다. 그래픽 미지원·데이터 로딩 실패·JavaScript 미사용 대체 경로도 별도로 확인했습니다. 자동 접근성 검사는 완전한 WCAG 인증을 의미하지 않으며, 캔버스·그라데이션 대비 등 자동 판정이 어려운 부분은 별도 시각 검수가 필요합니다.

이 사이트는 별도 방문자 분석 스크립트를 포함하지 않습니다. 모션 선택만 `notebook-lab:motion` 키로 브라우저에 저장합니다. 서비스 워커나 오프라인 캐시는 사용하지 않아 오래된 연구 결과가 고정되지 않게 했습니다. manifest는 오프라인 지원을 뜻하지 않습니다. 프로젝트 경로의 robots.txt는 호스트 루트의 검색 정책을 대체하지 않으며, 검색 노출은 검색엔진의 수집·색인에 달려 있습니다.

사진 출처·라이선스는 페이지 하단, 집계 데이터와 [ASSET_CREDITS.md](ASSET_CREDITS.md)에 표시했습니다. 코드와 사진의 이용 조건은 별개입니다. 코드에 별도 오픈소스 라이선스를 지정하지 않았습니다. Google 또는 Anthropic 공식·제휴 연구가 아닙니다.
