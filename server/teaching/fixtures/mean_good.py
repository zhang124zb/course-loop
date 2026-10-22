import sys

numbers = [float(item) for item in sys.stdin.read().split()]
print(sum(numbers) / len(numbers) if numbers else 0)
