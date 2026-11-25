from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("authn", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="refreshtoken",
            name="audience",
            field=models.CharField(default="web", max_length=16),
        ),
    ]
