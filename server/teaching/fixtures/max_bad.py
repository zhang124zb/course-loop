import sys

numbers = [int(item) for item in sys.stdin.read().split()]
maximum = 0
for number in numbers:
    if number > maximum:
        maximum = number
print(maximum)
