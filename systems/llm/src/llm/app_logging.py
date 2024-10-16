import logging
import json


def get_logger(*args, **kwargs):
    class JSONFormatter(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:
            ignored_fields = ['module', 'taskName', 'processName', 'threadName', 'thread', 'relativeCreated',
                              'msecs', 'filename', 'name', 'args', 'funcName', 'process', 'exc_info', 'exc_text','stack_info', 'created']
            severity_mapping = {
                logging.getLevelName(logging.NOTSET): 'DEFAULT',
                logging.getLevelName(logging.DEBUG): 'DEBUG',
                logging.getLevelName(logging.INFO): 'INFO',
                logging.getLevelName(logging.WARNING): 'WARNING',
                logging.getLevelName(logging.ERROR): 'ERROR',
                logging.getLevelName(logging.CRITICAL): 'CRITICAL'
            }
            record_dict = {k: v for k, v in record.__dict__.items() if
                           k not in ignored_fields}
            record_dict['severity'] = severity_mapping[record_dict['levelname']]
            record_dict['message'] = record_dict['msg']
            return json.dumps(record_dict)

    log_handler = logging.StreamHandler()
    logger = logging.getLogger(*args, **kwargs)
    logger.setLevel(logging.INFO)
    log_handler.setFormatter(JSONFormatter())
    logger.addHandler(log_handler)

    return logger
