from django.core.management.base import BaseCommand, CommandError
from teaching.models import AIConfig
from teaching.services.ai import AIServiceError, test_connection


class Command(BaseCommand):
    help = '使用当前模型做一次真实连接测试，供本机演示前预热；不下载模型。'

    def handle(self, *args, **options):
        config = AIConfig.objects.first()
        if not config:
            raise CommandError('请先初始化课程并配置模型。')
        self.stdout.write(f'正在预热模型 {config.model}，首次加载可能需要1—2分钟。')
        try:
            result = test_connection(config)
        except AIServiceError as error:
            raise CommandError(str(error)) from None
        self.stdout.write(self.style.SUCCESS(f"连接成功，耗时 {result['seconds']} 秒。"))
