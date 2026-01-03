import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { countWords } from '../../../common/utils/validation.helpers';

/**
 * Custom validator to ensure description has no word limit
 * This validator always passes - no restrictions on description length
 */
@ValidatorConstraint({ name: 'isValidDescription', async: false })
export class IsValidDescriptionConstraint implements ValidatorConstraintInterface {
  validate(description: any, args: ValidationArguments) {
    // No validation - allow any length description
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Description can be any length';
  }
}
