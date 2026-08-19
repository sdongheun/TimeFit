import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const questions = [
  {
    id: "RELEASE-01",
    title: "배포 일정: 부모 결정",
    reason: "기능·테스트·스토어 제출의 완료 조건을 나눠야 이후 자식 작업의 범위를 판단할 수 있습니다.",
    prompt: "현재 초안은 ‘8월 31일 기능 동결·회귀 테스트·TestFlight 가능, 9월 1~7일 실기기 베타·스토어 제출, 9월 21일 공개 배포’입니다. 유지하거나 바꿀 내용을 자유롭게 적어주세요.",
  },
  {
    id: "TIME-01",
    title: "시간 모델: 부모 결정",
    reason: "추천의 목적이 ‘지금 비는 시간’인지 ‘미래 일정 계획’인지에 따라 입력 UI, 운영시간, 저장 코스, 테스트 방식이 달라집니다.",
    prompt: "현재 초안은 ‘시작 시각은 현재 시각으로 고정, 약속이 있으면 약속 장소·시각만 입력, 미래 시작 시각 입력은 출시 범위에서 제외’입니다. 유지하거나 바꿀 내용을 자유롭게 적어주세요.",
  },
  {
    id: "TIME-01.1",
    parent: "TIME-01",
    title: "개발 테스트 시각: 자식 결정",
    reason: "운영 UI에서 미래 시간을 제거해도 새벽·과거·미래 운영시간과 위치 조합은 자동 테스트해야 합니다.",
    prompt: "개발 빌드에서만 고정 시각·출발지·약속 장소를 주입하는 테스트 하네스를 둡니다. 출시 앱에는 테스트 시간 입력 UI를 넣지 않습니다. 이 기준에서 추가로 필요한 테스트 조건을 적어주세요.",
  },
  {
    id: "TIME-01.2",
    parent: "TIME-01",
    title: "약속 없음의 종료 지점: 자식 결정",
    reason: "종료 지점이 없으면 마지막 장소에서 시간을 끝내는 과대 추천이 생기고, 매번 입력을 강제하면 즉시 사용성이 떨어집니다.",
    prompt: "기본값을 ‘현재 위치로 돌아오기’로 두고, 필요할 때만 집·역·다음 장소를 도착지로 추가하게 하는 방안을 검토 중입니다. 마지막 장소에서 시간을 끝내는 방식은 기본값으로 쓰지 않습니다. 유지하거나 바꿀 내용을 적어주세요.",
  },
  {
    id: "TIME-01.3",
    parent: "TIME-01",
    title: "약속 있음 입력: 자식 결정",
    reason: "시작 시각을 현재로 고정할 때 약속 장소·시각만으로 시간 예산을 계산할 수 있는지, 최소 입력이 충분한지 확인해야 합니다.",
    prompt: "약속이 있으면 약속 장소와 약속 시각만 입력하고 출발지는 현재 위치를 기본으로 둡니다. 직접 출발지 검색은 위치 권한 거절·오류의 대안으로만 제공합니다. 유지하거나 바꿀 내용을 적어주세요.",
  },
  {
    id: "REC-01",
    title: "추천 품질 기준: 부모 결정",
    reason: "공간·시간·운영시간 정책을 테스트 가능한 합격 기준으로 바꾸려면 실제 좋은 사례와 실패 사례가 필요합니다.",
    prompt: "좋은 추천과 명백히 잘못된 추천을 판단할 실제 상황을 3개 이상 적어주세요. 출발지, 약속지, 시간, 기대 장소 범위를 포함하면 좋습니다.",
  },
  {
    id: "COURSE-01",
    title: "코스 진행 UX: 부모 결정",
    reason: "추천 이후 저장·길찾기·변경·완료의 흐름이 명확해야 코스 데이터를 개인화 신호로 안전하게 쓸 수 있습니다.",
    prompt: "장바구니에서 코스를 만든 뒤 사용자가 반드시 할 수 있어야 하는 행동과, 헷갈리면 안 되는 정보를 적어주세요. 길찾기, 구간 수단, 변경, 취소, 완료를 포함해 자유롭게 적어주세요.",
  },
  {
    id: "PERSONAL-01",
    title: "피드백·개인화: 부모 결정",
    reason: "개인화 신호를 먼저 정의하지 않으면 불필요한 개인정보를 저장하거나, 적은 표본을 과도하게 추천에 반영할 수 있습니다.",
    prompt: "피드백을 언제 어떤 방식으로 받고, 어떤 행동·피드백이 이후 추천에 얼마나 약하게 영향을 줘야 하는지 적어주세요. 저장하면 안 되는 정보도 함께 적어주세요.",
  },
  {
    id: "TEST-01",
    title: "자동화 하네스: 부모 결정",
    reason: "8월 기능 동결 전에 반복 가능한 테스트가 없으면 실제 API·시간·GPS 변화로 버그를 재현할 수 없습니다.",
    prompt: "자동화로 가장 먼저 반복 검증하고 싶은 오류나 사용자 흐름을 적어주세요. 시뮬레이터, 실기기, DB, 지도 중 반드시 포함해야 할 대상도 적어주세요.",
  },
];

const knownDecisions = [
  "현재 지도에서 장소를 먼저 고르고, 이동수단은 장소 상세에서 구간 단위로 비교한다.",
  "약속이 있으면 출발지 생활권·약속지 생활권·두 지점 사이 경로 축 밖 장소는 자동 후보에서 제외한다.",
  "코스는 로그인 사용자에게 저장하며, 완료 후 전체 코스 별점은 필수, 자유 의견은 선택으로 둔다.",
  "개인화는 충분한 사용자 데이터 전까지 강한 필터가 아니라 약한 랭킹 가점으로만 사용한다.",
];

function markdownEscape(value) {
  return value.replaceAll("\r\n", "\n").trim() || "미응답";
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const answers = [];
  const now = new Date();
  const date = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const outputDir = path.resolve("docs/01_concept/requirements-interviews");
  const outputPath = path.join(outputDir, `${date}_요구사항인터뷰.md`);

  async function persist() {
    const body = [
      "# TimeFit 요구사항 인터뷰",
      "",
      `- 작성일: ${date}`,
      "- 작성 방식: 자유 서술형 터미널 인터뷰",
      "- 저장 정책: 각 문항 응답 직후 저장한다. 인터뷰가 중단되면 아래 기록은 미완료 초안이다.",
      "- 다음 단계: 응답을 기존 요구사항 ID와 비교해 동일·보완·충돌·신규로 판정한 뒤, 사용자 확정 후 기준 문서에 반영한다.",
      "",
      "## 기존 확정 기준",
      "",
      ...knownDecisions.map((decision) => `- ${decision}`),
      "",
      ...answers.flatMap(({ id, parent, title, reason, answer }) => [
        `## ${id} · ${title}`,
        "",
        `- 부모 결정: ${parent ?? "없음"}`,
        `- 이 질문을 하는 이유: ${reason}`,
        "",
        answer,
        "",
      ]),
    ].join("\n");

    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, `${body}\n`, "utf8");
  }

  console.log("\nTimeFit 요구사항 인터뷰");
  console.log("번호 형식은 필요 없습니다. 문장, 문단, 쉼표 등 편한 방식으로 답하세요.");
  console.log("이미 확정된 기준을 바꾸고 싶다면 해당 질문에서 함께 적으세요.\n");
  console.log("현재 확정된 기준:");
  for (const decision of knownDecisions) console.log(`- ${decision}`);
  console.log("");

  for (const question of questions) {
    if (question.parent) {
      console.log(`[부모 결정 ${question.parent}] ${question.reason}`);
    } else {
      console.log(`[부모 결정 ${question.id}] ${question.reason}`);
    }
    const answer = await rl.question(`[${question.title}]\n${question.prompt}\n> `);
    answers.push({ ...question, answer: markdownEscape(answer) });
    await persist();
    console.log(`저장됨: ${path.relative(process.cwd(), outputPath)}`);
    console.log("");
  }
  rl.close();
  console.log(`응답을 저장했습니다: ${path.relative(process.cwd(), outputPath)}`);
}

main().catch((error) => {
  console.error("인터뷰 저장 실패:", error);
  process.exitCode = 1;
});
