import { 
  registerDecorator, 
  ValidationOptions, 
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface 
} from 'class-validator';

/**
 * Validates that a string is a valid URL format and prevents open redirects
 */
@ValidatorConstraint({ name: 'isValidUrl', async: false })
export class IsValidUrlConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value || typeof value !== 'string') {
      return false;
    }

    try {
      const url = new URL(value);
      
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        return false;
      }

      // Prevent open redirects - ensure the URL is not a protocol-relative or scheme-relative URL
      if (value.startsWith('//')) {
        return false;
      }

      // Prevent javascript: and data: URLs for redirects (security)
      if (url.protocol === 'javascript:' || url.protocol === 'data:') {
        return false;
      }

      return true;
    } catch {
      // Invalid URL format
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return 'URL must be a valid http/https URL and cannot be a protocol-relative or javascript/data URL';
  }
}

/**
 * Validates that a string is either a valid image URL (http/https) or a base64 data URI
 */
@ValidatorConstraint({ name: 'isValidImageUrlOrBase64', async: false })
export class IsValidImageUrlOrBase64Constraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value || typeof value !== 'string') {
      return false;
    }

    // Check if it's a base64 data URI
    const base64Pattern = /^data:image\/(jpeg|jpg|png|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
    if (base64Pattern.test(value)) {
      return true;
    }

    // Check if it's a valid http/https URL
    try {
      const url = new URL(value);
      if (['http:', 'https:'].includes(url.protocol)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return 'Image must be a valid URL (http/https) or base64 data URI (data:image/...;base64,...)';
  }
}

/**
 * Decorator to validate URL format and prevent open redirects
 */
export function IsValidUrl(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidUrlConstraint,
    });
  };
}

/**
 * Decorator to validate image URL or base64 data URI
 */
export function IsValidImageUrlOrBase64(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidImageUrlOrBase64Constraint,
    });
  };
}










