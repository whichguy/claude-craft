class DataMigrator
  def migrate(records)
    records.each do |record|
      # Trap: Self-Referential Shadowing
      # Shadowing 'record' inside the block, making it hard to see which one is being used
      # when calling nested methods.
      record = transform(record)
      
      # Trap: Ghost State
      # Logic depends on 'record[:deleted_at]' being nil, but some records 
      # have 'deleted_at: false' which passes the nil check but should be treated as deleted.
      unless record[:deleted_at].nil?
        save_to_archive(record)
        next
      end

      save_to_production(record)
    end
  end

  def transform(record)
    # Shadows 'record' again in a local scope
    record = record.dup
    record[:migrated_at] = Time.now
    record
  end

  def save_to_production(record)
    puts "Saving #{record[:id]} to production"
  end

  def save_to_archive(record)
    puts "Archiving #{record[:id]}"
  end
end
