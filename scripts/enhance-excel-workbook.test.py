from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile
import importlib.util
import sys


sys.dont_write_bytecode = True
module_path = Path(__file__).with_name("enhance-excel-workbook.py")
spec = importlib.util.spec_from_file_location("enhance_excel_workbook", module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

with TemporaryDirectory() as directory:
    archive_path = Path(directory) / "bomb.xlsx"
    with ZipFile(archive_path, "w", ZIP_DEFLATED) as archive:
        archive.writestr("xl/worksheets/sheet1.xml", b"0" * (2 * 1024 * 1024))

    try:
        module.validate_workbook_archive(archive_path)
    except ValueError as error:
        assert "Rapporto di compressione" in str(error)
    else:
        raise AssertionError("Archivio ad alta espansione accettato")
