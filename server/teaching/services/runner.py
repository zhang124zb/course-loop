"""Run reviewed, immutable teaching examples. This is not an arbitrary-code sandbox."""

import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile

FIXTURE_DIR = Path(__file__).resolve().parent.parent / "fixtures"

# Populated with reviewed source digests during development, never from a request or DB.
FIXTURES = {'mean-bad-v1': {'key': 'mean-v1', 'file': 'mean_bad.py', 'label': '边界遗漏示例', 'sha256': '49eb7841139d9fb982a8eabc00b229af4cff640530e17247531e33d8759c1e65'}, 'mean-good-v1': {'key': 'mean-v1', 'file': 'mean_good.py', 'label': '订正示例', 'sha256': '2e076f53d1ff7d14d6440b85e689c7d7ca7e26a1f1ef093d5d9e2f11073151ff'}, 'max-bad-v1': {'key': 'max-v1', 'file': 'max_bad.py', 'label': '边界遗漏示例', 'sha256': '800a56ffe376f46bcd5bef5a6dd8bde9b83eb549ad68e93ac9beb6506b072968'}, 'max-good-v1': {'key': 'max-v1', 'file': 'max_good.py', 'label': '订正示例', 'sha256': '385f7f9ca778790582a2d408ef10884f46dba26a64a51bcae993409bbdc1ea31'}, 'count-bad-v1': {'key': 'count-v1', 'file': 'count_bad.py', 'label': '边界遗漏示例', 'sha256': 'a549884078cba3bc3bb556db67749a994d2f438b459c91c615e91953d048736a'}, 'count-good-v1': {'key': 'count-v1', 'file': 'count_good.py', 'label': '订正示例', 'sha256': 'd47560235494db53d2e83586f6d6336cd11ed08c33a4264946bdb722a505dc6b'}}

CASES = {
    "mean-v1": [("普通列表", "2 4 6", "4.0"), ("小数列表", "1.5 2.5", "2.0"), ("空输入", "", "0")],
    "max-v1": [("正数列表", "3 8 2", "8"), ("全负列表", "-5 -2 -9", "-2"), ("空输入", "", "0")],
    "count-v1": [("混合整数", "1 2 3 4", "2"), ("负偶数与零", "-2 0 3", "2"), ("空输入", "", "0")],
}


def _verified_source(fixture):
    raw = (FIXTURE_DIR / fixture["file"]).read_bytes()
    if hashlib.sha256(raw).hexdigest() != fixture["sha256"]:
        raise ValueError("已审核示例文件校验失败，已停止运行；请恢复经过审查的版本。")
    return raw.decode("utf-8").replace("\r\n", "\n")


def example_sources(fixture_key):
    return [
        {"id": identifier, "label": fixture["label"], "source": _verified_source(fixture)}
        for identifier, fixture in FIXTURES.items() if fixture["key"] == fixture_key
    ]


def evaluate_submission(submission):
    """Ignore client fixture IDs/results. Submitted text is only matched, never executed."""
    key = submission.assignment.task_version.fixture_key
    result = {"status": "pending", "score": None, "passed": 0, "total": 0,
              "fixture_id": "", "cases": [],
              "message": "已保存为待评测。当前仅运行固定的已审核示例；自行编辑的代码不会在本机执行。"}
    source = submission.source.replace("\r\n", "\n")
    try:
        match = None
        for identifier, fixture in FIXTURES.items():
            if fixture["key"] == key:
                reviewed = _verified_source(fixture)
                if source == reviewed:
                    match = (identifier, reviewed)
                    break
        if not match:
            return result
        identifier, reviewed = match
        cases = []
        # All executed source and stdin originate in the reviewed repository, not the DB.
        environment = {name: os.environ[name] for name in ("SystemRoot", "WINDIR") if name in os.environ}
        with tempfile.TemporaryDirectory(prefix="course-loop-example-") as directory:
            for label, stdin, expected in CASES[key]:
                process = subprocess.run(
                    [str(Path(sys.executable).resolve()), "-I", "-S", "-c", reviewed],
                    input=stdin.encode("utf-8"), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                    timeout=3, shell=False, cwd=directory, env=environment,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
                actual = process.stdout.decode("utf-8", errors="replace").strip()[:2000]
                error = ""
                if process.returncode:
                    error = "ZeroDivisionError：空输入时发生除零" if b"ZeroDivisionError" in process.stderr else "已审核示例运行错误"
                cases.append({"label": label, "passed": process.returncode == 0 and actual == expected,
                              "actual": actual if not error else error, "expected": expected})
        passed = sum(case["passed"] for case in cases)
        result.update(status="completed", score=round(passed / len(cases) * 100, 1), passed=passed,
                      total=len(cases), fixture_id=identifier, cases=cases,
                      message="已审核示例真实运行完成。该结果用于教学演示，不构成正式课程成绩。")
    except (ValueError, OSError, subprocess.SubprocessError):
        result.update(status="error", message="示例运行失败或文件校验未通过，请检查本机环境；提交内容已保存。")
    return result
