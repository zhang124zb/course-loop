/* Fresh public samples only; no local database, identities or secrets are exported. */
window.CourseLoopSeed = {
  "state": {
    "courses": [
      {
        "id": 1,
        "title": "Python程序设计（样例课程）",
        "language": "Python",
        "description": "大学 Python 教学演示，全部使用模拟数据。"
      }
    ],
    "classes": [
      {
        "id": 1,
        "courseId": 1,
        "name": "软件技术演示班",
        "teacherId": "teacher",
        "studentIds": [
          "student1",
          "student2",
          "student3",
          "student4"
        ]
      }
    ],
    "users": [
      {
        "id": "admin",
        "name": "演示管理员",
        "role": "admin",
        "active": true
      },
      {
        "id": "teacher",
        "name": "林老师（模拟）",
        "role": "teacher",
        "active": true
      },
      {
        "id": "student1",
        "name": "模拟学生1",
        "role": "student",
        "active": true
      },
      {
        "id": "student2",
        "name": "模拟学生2",
        "role": "student",
        "active": true
      },
      {
        "id": "student3",
        "name": "模拟学生3",
        "role": "student",
        "active": true
      },
      {
        "id": "student4",
        "name": "模拟学生4",
        "role": "student",
        "active": true
      }
    ],
    "resources": [
      {
        "id": 1,
        "title": "列表遍历与空输入 · 微课讲稿",
        "level": "basic",
        "kind": "video",
        "body": "【模拟教学材料】\n先判断列表是否为空，再使用 sum 与 len 计算平均值。\n思考：空列表为什么不能直接求平均？\n\n本条为讲稿示例，没有提供实际视频。",
        "published": true,
        "courseId": 1
      },
      {
        "id": 2,
        "title": "列表遍历与空输入 · 课件讲义",
        "level": "basic",
        "kind": "slides",
        "body": "【模拟教学材料】\n先判断列表是否为空，再使用 sum 与 len 计算平均值。\n思考：空列表为什么不能直接求平均？\n\n阅读 → 手工分析 → 编码 → 核对反馈 → 说明订正理由。",
        "published": true,
        "courseId": 1
      },
      {
        "id": 3,
        "title": "列表遍历与空输入 · 实训任务单",
        "level": "basic",
        "kind": "worksheet",
        "body": "【模拟教学材料】\n先判断列表是否为空，再使用 sum 与 len 计算平均值。\n思考：空列表为什么不能直接求平均？\n\n阅读 → 手工分析 → 编码 → 核对反馈 → 说明订正理由。",
        "published": true,
        "courseId": 1
      },
      {
        "id": 4,
        "title": "函数封装与边界测试 · 微课讲稿",
        "level": "comprehensive",
        "kind": "video",
        "body": "【模拟教学材料】\n将解析、计算和输出封装为函数。\n手工分析正常输入、空输入、负数和重复值，并说明每个用例。\n\n本条为讲稿示例，没有提供实际视频。",
        "published": true,
        "courseId": 1
      },
      {
        "id": 5,
        "title": "函数封装与边界测试 · 课件讲义",
        "level": "comprehensive",
        "kind": "slides",
        "body": "【模拟教学材料】\n将解析、计算和输出封装为函数。\n手工分析正常输入、空输入、负数和重复值，并说明每个用例。\n\n阅读 → 手工分析 → 编码 → 核对反馈 → 说明订正理由。",
        "published": true,
        "courseId": 1
      },
      {
        "id": 6,
        "title": "函数封装与边界测试 · 实训任务单",
        "level": "comprehensive",
        "kind": "worksheet",
        "body": "【模拟教学材料】\n将解析、计算和输出封装为函数。\n手工分析正常输入、空输入、负数和重复值，并说明每个用例。\n\n阅读 → 手工分析 → 编码 → 核对反馈 → 说明订正理由。",
        "published": true,
        "courseId": 1
      },
      {
        "id": 7,
        "title": "计数问题与复杂度 · 微课讲稿",
        "level": "contest",
        "kind": "video",
        "body": "【模拟教学材料】\n用一次遍历统计偶数个数，分析时间复杂度。\n负偶数与0也应计入，尝试给出覆盖这些情况的测试。\n\n本条为讲稿示例，没有提供实际视频。",
        "published": true,
        "courseId": 1
      },
      {
        "id": 8,
        "title": "计数问题与复杂度 · 课件讲义",
        "level": "contest",
        "kind": "slides",
        "body": "【模拟教学材料】\n用一次遍历统计偶数个数，分析时间复杂度。\n负偶数与0也应计入，尝试给出覆盖这些情况的测试。\n\n阅读 → 手工分析 → 编码 → 核对反馈 → 说明订正理由。",
        "published": true,
        "courseId": 1
      },
      {
        "id": 9,
        "title": "计数问题与复杂度 · 实训任务单",
        "level": "contest",
        "kind": "worksheet",
        "body": "【模拟教学材料】\n用一次遍历统计偶数个数，分析时间复杂度。\n负偶数与0也应计入，尝试给出覆盖这些情况的测试。\n\n阅读 → 手工分析 → 编码 → 核对反馈 → 说明订正理由。",
        "published": true,
        "courseId": 1
      }
    ],
    "tasks": [
      {
        "id": 1,
        "title": "列表平均值与空输入",
        "prompt": "输入若干整数或小数，用空格分隔，输出保留一位小数的平均值；空输入输出0。\n示例：输入1 2 3，输出2.0。",
        "level": "basic",
        "knowledgePoints": [
          "列表",
          "边界条件",
          "除零处理"
        ],
        "fixtureKey": "mean",
        "starterCode": "import sys\n\nnumbers = [float(item) for item in sys.stdin.read().split()]\nprint(sum(numbers) / len(numbers))\n"
      },
      {
        "id": 2,
        "title": "列表最大值与负数",
        "prompt": "输入若干整数，输出最大值；空输入输出0。\n特别检查全部是负数时的初始值。",
        "level": "advanced",
        "knowledgePoints": [
          "列表",
          "初始化",
          "负数"
        ],
        "fixtureKey": "max",
        "starterCode": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nmaximum = 0\nfor number in numbers:\n    if number > maximum:\n        maximum = number\nprint(maximum)\n"
      },
      {
        "id": 3,
        "title": "偶数计数与负数",
        "prompt": "输入若干整数，输出其中偶数的个数；空输入输出0。\n解释：为什么负偶数和0也应计入？",
        "level": "project",
        "knowledgePoints": [
          "条件判断",
          "取模",
          "边界测试"
        ],
        "fixtureKey": "count",
        "starterCode": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nprint(sum(1 for number in numbers if number > 0 and number % 2 == 0))\n"
      }
    ],
    "assignments": [
      {
        "id": 1,
        "taskId": 1,
        "classId": 1,
        "title": "列表平均值与空输入",
        "stage": "before",
        "status": "published",
        "resourceIds": [
          1,
          2,
          3
        ]
      },
      {
        "id": 2,
        "taskId": 2,
        "classId": 1,
        "title": "列表最大值与负数",
        "stage": "during",
        "status": "published",
        "resourceIds": [
          4,
          5,
          6
        ]
      },
      {
        "id": 3,
        "taskId": 3,
        "classId": 1,
        "title": "偶数计数与负数",
        "stage": "after",
        "status": "published",
        "resourceIds": [
          7,
          8,
          9
        ]
      }
    ],
    "submissions": [
      {
        "id": 1,
        "assignmentId": 1,
        "studentId": "student1",
        "source": "import sys\n\nnumbers = [float(item) for item in sys.stdin.read().split()]\nprint(sum(numbers) / len(numbers))\n",
        "status": "completed",
        "score": 66.7,
        "passed": 2,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正常平均值",
            "input": "1 2 3",
            "expected": "2.0",
            "actual": "2.0",
            "passed": true
          },
          {
            "name": "单个数",
            "input": "5",
            "expected": "5.0",
            "actual": "5.0",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "ZeroDivisionError",
            "passed": false
          }
        ]
      },
      {
        "id": 2,
        "assignmentId": 1,
        "studentId": "student2",
        "source": "import sys\n\nnumbers = [float(item) for item in sys.stdin.read().split()]\nprint(sum(numbers) / len(numbers))\n",
        "status": "completed",
        "score": 66.7,
        "passed": 2,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正常平均值",
            "input": "1 2 3",
            "expected": "2.0",
            "actual": "2.0",
            "passed": true
          },
          {
            "name": "单个数",
            "input": "5",
            "expected": "5.0",
            "actual": "5.0",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "ZeroDivisionError",
            "passed": false
          }
        ]
      },
      {
        "id": 3,
        "assignmentId": 1,
        "studentId": "student3",
        "source": "import sys\n\nnumbers = [float(item) for item in sys.stdin.read().split()]\nprint(sum(numbers) / len(numbers))\n",
        "status": "completed",
        "score": 66.7,
        "passed": 2,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正常平均值",
            "input": "1 2 3",
            "expected": "2.0",
            "actual": "2.0",
            "passed": true
          },
          {
            "name": "单个数",
            "input": "5",
            "expected": "5.0",
            "actual": "5.0",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "ZeroDivisionError",
            "passed": false
          }
        ]
      },
      {
        "id": 4,
        "assignmentId": 1,
        "studentId": "student4",
        "source": "import sys\n\nnumbers = [float(item) for item in sys.stdin.read().split()]\nprint(sum(numbers) / len(numbers) if numbers else 0)\n",
        "status": "completed",
        "score": 100.0,
        "passed": 3,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正常平均值",
            "input": "1 2 3",
            "expected": "2.0",
            "actual": "2.0",
            "passed": true
          },
          {
            "name": "单个数",
            "input": "5",
            "expected": "5.0",
            "actual": "5.0",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "0",
            "passed": true
          }
        ]
      },
      {
        "id": 5,
        "assignmentId": 2,
        "studentId": "student1",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nmaximum = 0\nfor number in numbers:\n    if number > maximum:\n        maximum = number\nprint(maximum)\n",
        "status": "completed",
        "score": 66.7,
        "passed": 2,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正数",
            "input": "1 3 2",
            "expected": "3",
            "actual": "3",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "全部为负数",
            "input": "-5 -2 -9",
            "expected": "-2",
            "actual": "0",
            "passed": false
          }
        ]
      },
      {
        "id": 6,
        "assignmentId": 2,
        "studentId": "student2",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nmaximum = 0\nfor number in numbers:\n    if number > maximum:\n        maximum = number\nprint(maximum)\n",
        "status": "completed",
        "score": 66.7,
        "passed": 2,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正数",
            "input": "1 3 2",
            "expected": "3",
            "actual": "3",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "全部为负数",
            "input": "-5 -2 -9",
            "expected": "-2",
            "actual": "0",
            "passed": false
          }
        ]
      },
      {
        "id": 7,
        "assignmentId": 2,
        "studentId": "student3",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nmaximum = 0\nfor number in numbers:\n    if number > maximum:\n        maximum = number\nprint(maximum)\n",
        "status": "completed",
        "score": 66.7,
        "passed": 2,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正数",
            "input": "1 3 2",
            "expected": "3",
            "actual": "3",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "全部为负数",
            "input": "-5 -2 -9",
            "expected": "-2",
            "actual": "0",
            "passed": false
          }
        ]
      },
      {
        "id": 8,
        "assignmentId": 2,
        "studentId": "student4",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nprint(max(numbers) if numbers else 0)\n",
        "status": "completed",
        "score": 100.0,
        "passed": 3,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正数",
            "input": "1 3 2",
            "expected": "3",
            "actual": "3",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "全部为负数",
            "input": "-5 -2 -9",
            "expected": "-2",
            "actual": "-2",
            "passed": true
          }
        ]
      },
      {
        "id": 9,
        "assignmentId": 3,
        "studentId": "student1",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nprint(sum(1 for number in numbers if number > 0 and number % 2 == 0))\n",
        "status": "completed",
        "score": 66.7,
        "passed": 2,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正偶数",
            "input": "1 2 3 4",
            "expected": "2",
            "actual": "2",
            "passed": true
          },
          {
            "name": "无偶数",
            "input": "1 3 5",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "负偶数与0",
            "input": "-2 0 2",
            "expected": "3",
            "actual": "1",
            "passed": false
          }
        ]
      },
      {
        "id": 10,
        "assignmentId": 3,
        "studentId": "student2",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nprint(sum(1 for number in numbers if number > 0 and number % 2 == 0))\n",
        "status": "completed",
        "score": 66.7,
        "passed": 2,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正偶数",
            "input": "1 2 3 4",
            "expected": "2",
            "actual": "2",
            "passed": true
          },
          {
            "name": "无偶数",
            "input": "1 3 5",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "负偶数与0",
            "input": "-2 0 2",
            "expected": "3",
            "actual": "1",
            "passed": false
          }
        ]
      },
      {
        "id": 11,
        "assignmentId": 3,
        "studentId": "student3",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nprint(sum(1 for number in numbers if number > 0 and number % 2 == 0))\n",
        "status": "completed",
        "score": 66.7,
        "passed": 2,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正偶数",
            "input": "1 2 3 4",
            "expected": "2",
            "actual": "2",
            "passed": true
          },
          {
            "name": "无偶数",
            "input": "1 3 5",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "负偶数与0",
            "input": "-2 0 2",
            "expected": "3",
            "actual": "1",
            "passed": false
          }
        ]
      },
      {
        "id": 12,
        "assignmentId": 3,
        "studentId": "student4",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nprint(sum(1 for number in numbers if number % 2 == 0))\n",
        "status": "completed",
        "score": 100.0,
        "passed": 3,
        "total": 3,
        "createdAt": "2026-10-22T09:15:00+08:00",
        "feedback": "固定示例的预设评测结果，浏览器未执行代码。",
        "cases": [
          {
            "name": "正偶数",
            "input": "1 2 3 4",
            "expected": "2",
            "actual": "2",
            "passed": true
          },
          {
            "name": "无偶数",
            "input": "1 3 5",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "负偶数与0",
            "input": "-2 0 2",
            "expected": "3",
            "actual": "3",
            "passed": true
          }
        ]
      }
    ],
    "reports": [],
    "progress": [],
    "audit": [
      {
        "id": 1,
        "event": "demo.initialized",
        "actorId": "system",
        "objectLabel": "初始化全新模拟课程与班级",
        "createdAt": "2026-10-22T09:15:00+08:00"
      }
    ],
    "aiConfig": {
      "label": "DeepSeek 演示配置",
      "baseUrl": "https://api.deepseek.com/v1",
      "model": "deepseek-flash",
      "timeout": 60
    }
  },
  "fixtures": {
    "mean": [
      {
        "id": "mean-bad",
        "label": "边界遗漏示例",
        "source": "import sys\n\nnumbers = [float(item) for item in sys.stdin.read().split()]\nprint(sum(numbers) / len(numbers))\n",
        "passed": 2,
        "total": 3,
        "cases": [
          {
            "name": "正常平均值",
            "input": "1 2 3",
            "expected": "2.0",
            "actual": "2.0",
            "passed": true
          },
          {
            "name": "单个数",
            "input": "5",
            "expected": "5.0",
            "actual": "5.0",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "ZeroDivisionError",
            "passed": false
          }
        ]
      },
      {
        "id": "mean-good",
        "label": "订正示例",
        "source": "import sys\n\nnumbers = [float(item) for item in sys.stdin.read().split()]\nprint(sum(numbers) / len(numbers) if numbers else 0)\n",
        "passed": 3,
        "total": 3,
        "cases": [
          {
            "name": "正常平均值",
            "input": "1 2 3",
            "expected": "2.0",
            "actual": "2.0",
            "passed": true
          },
          {
            "name": "单个数",
            "input": "5",
            "expected": "5.0",
            "actual": "5.0",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "0",
            "passed": true
          }
        ]
      }
    ],
    "max": [
      {
        "id": "max-bad",
        "label": "边界遗漏示例",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nmaximum = 0\nfor number in numbers:\n    if number > maximum:\n        maximum = number\nprint(maximum)\n",
        "passed": 2,
        "total": 3,
        "cases": [
          {
            "name": "正数",
            "input": "1 3 2",
            "expected": "3",
            "actual": "3",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "全部为负数",
            "input": "-5 -2 -9",
            "expected": "-2",
            "actual": "0",
            "passed": false
          }
        ]
      },
      {
        "id": "max-good",
        "label": "订正示例",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nprint(max(numbers) if numbers else 0)\n",
        "passed": 3,
        "total": 3,
        "cases": [
          {
            "name": "正数",
            "input": "1 3 2",
            "expected": "3",
            "actual": "3",
            "passed": true
          },
          {
            "name": "空输入",
            "input": "",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "全部为负数",
            "input": "-5 -2 -9",
            "expected": "-2",
            "actual": "-2",
            "passed": true
          }
        ]
      }
    ],
    "count": [
      {
        "id": "count-bad",
        "label": "边界遗漏示例",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nprint(sum(1 for number in numbers if number > 0 and number % 2 == 0))\n",
        "passed": 2,
        "total": 3,
        "cases": [
          {
            "name": "正偶数",
            "input": "1 2 3 4",
            "expected": "2",
            "actual": "2",
            "passed": true
          },
          {
            "name": "无偶数",
            "input": "1 3 5",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "负偶数与0",
            "input": "-2 0 2",
            "expected": "3",
            "actual": "1",
            "passed": false
          }
        ]
      },
      {
        "id": "count-good",
        "label": "订正示例",
        "source": "import sys\n\nnumbers = [int(item) for item in sys.stdin.read().split()]\nprint(sum(1 for number in numbers if number % 2 == 0))\n",
        "passed": 3,
        "total": 3,
        "cases": [
          {
            "name": "正偶数",
            "input": "1 2 3 4",
            "expected": "2",
            "actual": "2",
            "passed": true
          },
          {
            "name": "无偶数",
            "input": "1 3 5",
            "expected": "0",
            "actual": "0",
            "passed": true
          },
          {
            "name": "负偶数与0",
            "input": "-2 0 2",
            "expected": "3",
            "actual": "3",
            "passed": true
          }
        ]
      }
    ]
  }
};
