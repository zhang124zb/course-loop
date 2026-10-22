import sys

numbers = [int(item) for item in sys.stdin.read().split()]
print(max(numbers) if numbers else 0)
