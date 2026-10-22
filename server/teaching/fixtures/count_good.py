import sys

numbers = [int(item) for item in sys.stdin.read().split()]
print(sum(1 for number in numbers if number % 2 == 0))
