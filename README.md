# Github CodeReviewBot

Github CodeReviewBot은 LaaS를 활용한 코드리뷰 로봇입니다.

### 설정

1. Github CodeReviewBot을 적용할 레포지토리로 이동합니다.
2. `Settings` 클릭
3. `Secrets and variables` 메뉴 밑의 `Actions` 를 클릭
4. `Repository secrets` 탭으로 변경합니다, `New repository secret` 버튼을 눌러서 새로운 `LAAS_API_KEY` 변수를 생성합니다.
5. 레포지토리에 `.github/workflows/cr.yml`파일을 생성하고, 아래의 내용을 추가합니다.

```yml
name: Code Review

permissions:
  contents: read
  pull-requests: write

on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: jeongsk/Github-CodeReviewBot@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          LAAS_API_KEY: ${{ secrets.LAAS_API_KEY }}
```

### 사용

1. 새로운 PR을 생성하면 봇이 자동으로 코드 리뷰를 수행하며, 리뷰 결과는 PR 타임라인에 표시됩니다.
2. `git push` 이후에 Pull request를 업데이트하면, 봇은 변경된 파일을 다시 검토합니다.
